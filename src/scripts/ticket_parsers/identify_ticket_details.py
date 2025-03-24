import re
import json
import os
import sys
import pytesseract
from PIL import Image
import cv2
import numpy as np
from dataclasses import dataclass
from trainline_ticket_digital_config import get_trainline_configuration
from config import tesseract_path
from typing import Dict, List, Optional, Tuple, Any

# Path to tesseract executable
pytesseract.pytesseract.tesseract_cmd = tesseract_path

# Debug mode flag - will be set from command line
DEBUG_ROI = False
DEBUG_DIR = "debug_roi_images"

@dataclass
class TicketField:
    name: str
    patterns: List[str]
    region: Optional[Tuple[float, float, float, float]] = None  # x1, y1, x2, y2 as ratios of width/height


class TicketScanner:
    def __init__(self, configurations=None, debug_roi=False, debug_dir="debug_roi_images"):
        """
        Initialize the TicketScanner with various ticket configurations.
        
        :param configurations: Dictionary defining different ticket layouts and how to extract details.
        :param debug_roi: Whether to save ROI images for debugging.
        :param debug_dir: Directory to save ROI debug images.
        """
        self.configurations = configurations or self._get_default_configurations()
        self.ticket_type = None
        self.extracted_data = {}
        self.confidence_scores = {}
        self.preprocessed_image = None
        self.debug_roi = debug_roi
        self.debug_dir = debug_dir
        
        # Create debug directory if it doesn't exist
        if self.debug_roi and not os.path.exists(self.debug_dir):
            os.makedirs(self.debug_dir)
        
    def scan(self, image_path):
        """
        Main scanning function that orchestrates the ticket analysis process.
        
        :param image_path: Path to the ticket image
        :return: Dictionary with extracted ticket details and metadata
        """
        # Load and preprocess the image
        original_image = cv2.imread(image_path)
        if original_image is None:
            raise ValueError(f"Could not load image from {image_path}")
            
        # Get the image filename for debug naming
        self.image_basename = os.path.splitext(os.path.basename(image_path))[0]

        # Determine ticket type (paper vs digital)
        self.ticket_type = self._determine_ticket_type(original_image)
        # Preprocess based on ticket type
        self.preprocessed_image = self._preprocess_image(original_image)
        
        # Crop the ticket if possible
        cropped_image = self._crop_ticket(self.preprocessed_image)
        if cropped_image is not None:
            working_image = cropped_image
            
            # Save cropped image if debugging
            if self.debug_roi:
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_cropped.jpg")
                cv2.imwrite(debug_path, cropped_image)
        else:
            working_image = self.preprocessed_image
        
        # Select the appropriate configuration based on detected ticket type
        config_name = self._select_configuration(working_image)
        
        # Extract ticket details
        self.extracted_data = self._extract_ticket_details(working_image, config_name)
        
        # Post-process and validate the extracted data
        #self._validate_and_correct_data()
        
        # Generate reference if missing
        if "ticket_reference" not in self.extracted_data:
            self._generate_ticket_reference()
        
        return {
            "ticket_type": self.ticket_type,
            "configuration_used": config_name,
            "data": self.extracted_data,
            "confidence": self.confidence_scores
        }
    
    def _determine_ticket_type(self, image):
        """
        Determine if an image is a paper or digital train ticket.
        
        :param image: The input image as numpy array
        :return: "paper" or "digital"
        """
        # Convert to RGB for consistent processing
        if len(image.shape) == 3 and image.shape[2] == 3:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            # If grayscale, convert to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        
        height, width, _ = rgb_image.shape
        
        # Feature extraction for ticket type classification
        features = {
            "orange_bar": 0,
            "texture": 0,
            "perspective": 0,
            "shadow": 0,
            "digital_elements": 0
        }
        
        # 1. Check for orange bar (top region)
        top_region = rgb_image[:height // 10, :, :]
        
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_top_region.jpg")
            cv2.imwrite(debug_path, cv2.cvtColor(top_region, cv2.COLOR_RGB2BGR))
            
        hsv_image = cv2.cvtColor(top_region, cv2.COLOR_RGB2HSV)
        lower_orange = np.array([10, 100, 100])
        upper_orange = np.array([25, 255, 255])
        mask = cv2.inRange(hsv_image, lower_orange, upper_orange)
        
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_orange_mask.jpg")
            cv2.imwrite(debug_path, mask)
            
        orange_pixels = np.count_nonzero(mask)
        features["orange_bar"] = 1 if (orange_pixels / mask.size) > 0.2 else 0
        
        # 2. Check for paper texture (high frequency components)
        gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        texture_measure = np.std(gray - blur)
        
        if self.debug_roi:
            texture_image = gray - blur
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_texture.jpg")
            cv2.imwrite(debug_path, texture_image)
            
        features["texture"] = 1 if texture_measure > 10 else 0
        
        # 3. Check for perspective distortion
        edges = cv2.Canny(gray, 50, 150)
        
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_edges.jpg")
            cv2.imwrite(debug_path, edges)
            
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        if lines is not None:
            angles = [np.arctan2(line[0][3] - line[0][1], line[0][2] - line[0][0]) for line in lines]
            angle_variation = np.std(angles) if angles else 0
            features["perspective"] = 1 if angle_variation > 0.05 else 0
        else:
            features["perspective"] = 0

            
            if self.debug_roi:
                # Draw lines on a copy of the image
                line_image = rgb_image.copy()
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    cv2.line(line_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_lines.jpg")
                cv2.imwrite(debug_path, cv2.cvtColor(line_image, cv2.COLOR_RGB2BGR))
        
        # 4. Check for shadows (paper tickets often have uneven lighting)
        if len(image.shape) == 3 and image.shape[2] == 3:
            lab_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
            illumination = cv2.split(lab_image)[0]
            illumination_var = np.std(illumination)
            features["shadow"] = 1 if illumination_var > 15 else 0
        else:
            features["shadow"] = 0
        
        # 5. Check for digital elements (perfect alignment, QR codes)
        qr_detected = False
        # OpenCV QR detector
        qr_detector = cv2.QRCodeDetector()
        has_qr, _, _ = qr_detector.detectAndDecode(gray)
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Apply binary thresholding to create a black and white image
        # For QR code detection, a simple binary threshold often works well
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_threshold.jpg")
            cv2.imwrite(debug_path, thresh)
            
        if has_qr:
            qr_detected = True
            features["digital_elements"] += 1
        else:
            # Try finding rectangular patterns characteristic of QR codes
            # Look for a grid of black/white pixels with high contrast
            blocks = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            # Count number of small rectangular blocks
            # If > threshold, likely a QR code
        
        text = pytesseract.image_to_string(image)
        
        # Save OCR result for debugging
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_ocr_text.txt")
            with open(debug_path, 'w') as f:
                f.write(text)
                
        if any(pattern in text.lower() for pattern in ["add to wallet", "google wallet", "show railcard", "eticket"]):
            features["digital_elements"] += 2.0

        # Calculate paper vs digital score
        paper_score = (
            features["orange_bar"] * 1.5 + 
            features["texture"] * 1.0 + 
            features["perspective"] * 0.8 + 
            features["shadow"] * 0.7 - 
            features["digital_elements"] * 2.0
        )
        # Save feature scores for debugging
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_features.json")
            with open(debug_path, 'w') as f:
                json.dump({
                    "features": features,
                    "paper_score": float(paper_score),  # Convert to float explicitly
                    "result": "paper" if paper_score > 0.5 else "digital"
                }, f, indent=2)
        

        return "paper" if paper_score > 0.5 else "digital"
    
    def _preprocess_image(self, image):
        """
        Preprocess the image based on detected ticket type.
        
        :param image: Original image as numpy array
        :return: Preprocessed image
        """
        if self.ticket_type == "paper":
            # Paper ticket preprocessing
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            if self.debug_roi:
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_gray.jpg")
                cv2.imwrite(debug_path, gray)
            
            # Adaptive thresholding to handle varying lighting
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            if self.debug_roi:
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_adaptive_thresh.jpg")
                cv2.imwrite(debug_path, thresh)
            
            # Check if perspective correction is needed
            edges = cv2.Canny(thresh, 50, 150)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
            
            # If we have clear lines and they're not perfectly horizontal/vertical
            if lines is not None:
                angles = [np.arctan2(line[0][3] - line[0][1], line[0][2] - line[0][0]) 
                          for line in lines]
                angle_variation = np.std(angles)
                
                if angle_variation > 0.1:  # Significant variation - needs deskewing
                    # Find the largest contour (presumably the ticket)
                    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if contours:
                        largest_contour = max(contours, key=cv2.contourArea)
                        rect = cv2.minAreaRect(largest_contour)
                        box = cv2.boxPoints(rect)
                        box = np.int32(box)
                        
                        if self.debug_roi:
                            # Draw contour on original image
                            contour_image = image.copy()
                            cv2.drawContours(contour_image, [box], 0, (0, 255, 0), 2)
                            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_largest_contour.jpg")
                            cv2.imwrite(debug_path, contour_image)
                        
                        # Get width and height of the detected rectangle
                        width = int(rect[1][0])
                        height = int(rect[1][1])
                        
                        # Create perspective transform matrix
                        src_pts = box.astype("float32")
                        dst_pts = np.array([[0, height-1],
                                           [0, 0],
                                           [width-1, 0],
                                           [width-1, height-1]], dtype="float32")
                        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
                        
                        # Apply perspective transformation
                        warped = cv2.warpPerspective(image, M, (width, height))
                        
                        if self.debug_roi:
                            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_warped.jpg")
                            cv2.imwrite(debug_path, warped)
                        
                        return warped
            
            # If no perspective correction was needed/possible
            return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
            
        else:  # Digital ticket
            # For digital tickets, simple noise reduction and contrast enhancement
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced_lab = cv2.merge((cl, a, b))
            enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
            
            if self.debug_roi:
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_enhanced.jpg")
                cv2.imwrite(debug_path, enhanced_bgr)
            
            return enhanced_bgr
    
    def _crop_ticket(self, image):
        """
        Automatically crop the ticket from an image.
        
        :param image: The preprocessed image
        :return: Cropped ticket image or None if unsuccessful
        """
        # Convert to grayscale if it's not already
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
            
        # Apply edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_crop_edges.jpg")
            cv2.imwrite(debug_path, edges)
        
        # Find contours and select the largest rectangular one
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
            
        # Sort contours by area, largest first
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        if self.debug_roi:
            # Draw all contours
            contour_image = image.copy()
            cv2.drawContours(contour_image, contours[:5], -1, (0, 255, 0), 2)
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_all_contours.jpg")
            cv2.imwrite(debug_path, contour_image)
        
        for contour in contours[:5]:  # Check the 5 largest contours
            # Approximate the contour
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # If our approximated contour has four points, we can assume it's the ticket
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                
                # Check aspect ratio
                aspect_ratio = w / h
                expected_ratio = 2.2 if self.ticket_type == "paper" else 1.5  # Digital can be more square
                valid_ratio = (1.8 < aspect_ratio < 2.5) if self.ticket_type == "paper" else (1.0 < aspect_ratio < 2.5)
                
                if valid_ratio:
                    # Ensure it's not too small
                    if w * h > (image.shape[0] * image.shape[1] * 0.2):  # At least 20% of image
                        if self.debug_roi:
                            # Draw selected contour
                            rect_image = image.copy()
                            cv2.rectangle(rect_image, (x, y), (x+w, y+h), (0, 0, 255), 2)
                            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_selected_rect.jpg")
                            cv2.imwrite(debug_path, rect_image)
                            
                        cropped = image[y:y+h, x:x+w]
                        return cropped
        
        # If we didn't find a suitable contour, use the largest one
        x, y, w, h = cv2.boundingRect(contours[0])
        if w * h > (image.shape[0] * image.shape[1] * 0.3):  # At least 30% of image
            if self.debug_roi:
                # Draw fallback contour
                rect_image = image.copy()
                cv2.rectangle(rect_image, (x, y), (x+w, y+h), (255, 0, 0), 2)
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_fallback_rect.jpg")
                cv2.imwrite(debug_path, rect_image)
                
            return image[y:y+h, x:x+w]
            
        return None  # No valid ticket found
    
    def _select_configuration(self, image):
        """
        Select the appropriate configuration based on OCR text from the image.
        
        :param image: The preprocessed image
        :return: Configuration name to use
        """
        # Run quick OCR to identify ticket issuer/type
        text = pytesseract.image_to_string(image)
        if self.debug_roi:
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_config_ocr.txt")
            with open(debug_path, 'w') as f:
                f.write(text)
        
        # Check against known patterns for different ticket types
        for config_name, indicators in {
            "gwr": ["great western", "gwr"],
            "lner": ["lner", "london north eastern"],
            "tfl": ["transport for london", "tfl", "oyster"],
            "avanti": ["avanti", "west coast"],
            "trainline_app": ["trainline", "mobile ticket", "qr code"],
            "generic_digital": []  # Fallback
        }.items():
            if any(indicator in text.lower() for indicator in indicators):
                return config_name
        
        # Default to generic if no match found
        return "generic_digital"
     
    def _extract_ticket_details(self, image, config_name):
        """
        Extract train ticket details from an image using OCR based on a specific configuration.
        
        :param image: Preprocessed image
        :param config_name: Name of the ticket format configuration to use
        :return: Dictionary with extracted ticket details
        """
        if config_name not in self.configurations:
            config_name = "generic"  # Fallback to generic
        
        config = self.configurations[config_name]
        details = {}
        
        # Get image dimensions for relative region calculations
        height, width = image.shape[:2]
        
        # Create a visualization image with all ROIs drawn on it
        if self.debug_roi:
            debug_image = image.copy()
            # Add a 10x10 grid to the image
            grid_image = image.copy()
            
            # Draw the grid lines
            grid_color = (0, 0, 255)  # Red color for the grid
            line_thickness = 1
            
            # Draw horizontal lines
            for i in range(1, 10):
                y = int(height * i / 10)
                cv2.line(grid_image, (0, y), (width, y), grid_color, line_thickness)
                # Add y-coordinate label (as a ratio)
                ratio = i / 10.0
                cv2.putText(grid_image, f"{ratio:.1f}", (5, y-5), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
            # Draw vertical lines
            for i in range(1, 10):
                x = int(width * i / 10)
                cv2.line(grid_image, (x, 0), (x, height), grid_color, line_thickness)
                # Add x-coordinate label (as a ratio)
                ratio = i / 10.0
                cv2.putText(grid_image, f"{ratio:.1f}", (x+5, 15), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
            # Save the grid image
            debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_grid.jpg")
            cv2.imwrite(debug_path, grid_image)
        
        # Process each field in the configuration
        for i, field in enumerate(config):
            # If region is specified, only OCR that part
            if field.region:
                x1, y1, x2, y2 = field.region
                # Convert relative coordinates to absolute
                roi_x1 = int(x1 * width)
                roi_y1 = int(y1 * height)
                roi_x2 = int(x2 * width)
                roi_y2 = int(y2 * height)
                
                # Extract region of interest
                roi = image[roi_y1:roi_y2, roi_x1:roi_x2]
                
                # Skip if ROI is empty
                if roi.size == 0:
                    continue
                
                # Draw ROI on debug image if debugging is enabled
                if self.debug_roi:
                    # Draw rectangle and text on the debug image
                    cv2.rectangle(debug_image, (roi_x1, roi_y1), (roi_x2, roi_y2), (0, 255, 0), 2)
                    # Add region coordinates as text (in ratio format)
                    coord_text = f"({x1:.1f},{y1:.1f})-({x2:.1f},{y2:.1f})"
                    cv2.putText(debug_image, f"{field.name}: {coord_text}", (roi_x1, roi_y1-10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                
                    # Save the actual ROI
                    debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_roi_{i}_{field.name}.jpg")
                    cv2.imwrite(debug_path, roi)

                    # OCR the region
                text = pytesseract.image_to_string(roi)
                
                # Save OCR result for debugging
                if self.debug_roi:
                    debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_roi_{i}_{field.name}_text.txt")
                    with open(debug_path, 'w') as f:
                        f.write(text)
            else:
                # Use full image if no region specified
                text = pytesseract.image_to_string(image)
            
            # Rest of the function remains the same...
            # [Processing logic]
        
        # Save the visualization image with all ROIs
            if self.debug_roi:
                debug_path = os.path.join(self.debug_dir, f"{self.image_basename}_all_roi.jpg")
                cv2.imwrite(debug_path, debug_image)
            

            # Try to match each pattern
            for pattern in field.patterns:
                match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
                if match:
                    details[field.name] = match.group(0).strip()
                    self.confidence_scores[field.name] = 1.0  # High confidence for direct matches
                    break
            
            # If no match but field should exist, try fuzzy matching
            if field.name not in details and text:
                # Simple approach for fuzzy matching
                #TODO: Implement proper fuzzy matching using fuzzywuzzy or rapidfuzz
                for pattern in field.patterns:
                    # Remove regex special chars
                    clean_pattern = re.sub(r'[\(\)\[\]\{\}\.\+\*\?\|\^\$]', '', pattern)
                    clean_pattern = re.sub(r'\\d\+', '', clean_pattern)
                    clean_pattern = clean_pattern.replace('\\s+', ' ').strip()
                    
                    if clean_pattern and clean_pattern in text:
                        # Find the text after the pattern
                        pos = text.find(clean_pattern) + len(clean_pattern)
                        if pos < len(text):
                            # Take the next few words
                            possible_value = text[pos:pos+30].split('\n')[0].strip()
                            details[field.name] = possible_value
                            self.confidence_scores[field.name] = 0.6  # Lower confidence
                            break
        return details

        
    def _validate_and_correct_data(self):
        """
        Apply validation rules and corrections to extracted data.
        """
        # Example validation for station names
        if 'origin_station' in self.extracted_data:
            origin = self.extracted_data['origin_station']
            #TODO:  Clean up common OCR errors in station names 
            origin = re.sub(r'l\b', '1', origin)  # Replace lone 'l' with '1'
            origin = re.sub(r'0', 'O', origin)    # Replace '0' with 'O' in station names
            #TODO: Add station list in a separate file and use it for validation
            # Example simple station name validation (replace with comprehensive version)
            known_stations = ["London Paddington", "Bristol Temple Meads", "Reading", "Oxford", 
                             "Grantham", "Liverpool Lime Street", "Manchester Piccadilly"] 
            best_match = None
            best_score = 0
            
            # Simple string similarity as placeholder
            for station in known_stations:
                common_chars = sum(1 for c in origin if c in station)
                similarity = common_chars / max(len(origin), len(station))
                
                if similarity > best_score and similarity > 0.7:
                    best_score = similarity
                    best_match = station
            
            if best_match:
                self.extracted_data['origin_station'] = best_match
                self.confidence_scores['origin_station'] = best_score
        
        # Date format standardization
        if 'date' in self.extracted_data:
            date_str = self.extracted_data['date']
            
            # Try various date formats
            date_formats = [
                r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})',  # DD/MM/YYYY or similar
                r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{2,4})'  # 1st Jan 2023
            ]
            
            for format_pattern in date_formats:
                match = re.search(format_pattern, date_str)
                if match:
                    # Standardize to YYYY-MM-DD
                    day, month, year = match.groups()
                    
                    # Convert text month to number if needed
                    if not month.isdigit():
                        month_dict = {
                            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
                        }
                        month = month_dict.get(month[:3].lower(), month)
                    
                    # Add century if needed
                    if len(year) == 2:
                        year = '20' + year if int(year) < 50 else '19' + year
                    
                    self.extracted_data['date'] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                    break
    
    def _generate_ticket_reference(self):
        """
        Generate a ticket reference if one was not found.
        """
        ref_parts = []
        
        # Use origin and destination codes if available
        if 'origin_code' in self.extracted_data:
            ref_parts.append(self.extracted_data['origin_code'])
        elif 'origin_station' in self.extracted_data:
            ref_parts.append(self.extracted_data['origin_station'][:3].upper())
            
        if 'destination_code' in self.extracted_data:
            ref_parts.append(self.extracted_data['destination_code'])
        elif 'destination_station' in self.extracted_data:
            ref_parts.append(self.extracted_data['destination_station'][:3].upper())
            
        # Add timestamp
        import time
        ref_parts.append(str(int(time.time()))[-6:])  # Last 6 digits of timestamp
        
        self.extracted_data['ticket_reference'] = '-'.join(ref_parts)
        self.extracted_data['is_reference_generated'] = True
        self.confidence_scores['ticket_reference'] = 0.5
    
    def _get_default_configurations(self):
        """
        Get default configurations for common UK train tickets.
        
        :return: Dictionary of ticket configurations
        """
        configs = {
            "generic": [
                TicketField("origin_station", [r"(?:From|Origin)[:\s]+(.+?)(?:\s+to|\s*$|[,\.])", r"ORIGIN[:\s]+(.+?)(?:\s+to|\s*$|[,\.])"], (0.05, 0.2, 0.45, 0.4)),
                TicketField("destination_station", [r"(?:To|Destination)[:\s]+(.+?)(?:\s*$|[,\.])", r"DESTINATION[:\s]+(.+?)(?:\s*$|[,\.])"], (0.55, 0.2, 0.95, 0.4)),
                TicketField("date", [r"(?:Date|Valid)[:\s]+([0-9]{1,2}[\/\.\-][0-9]{1,2}[\/\.\-][0-9]{2,4})", r"(?:Date|Valid)[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{2,4})"], (0.1, 0.4, 0.9, 0.6)),
                TicketField("ticket_type", [r"(?:Type|Class)[:\s]+(.+?)(?:\s*$|[,\.])", r"(STANDARD|FIRST|1ST|ANYTIME|OFF-PEAK|SUPER OFF-PEAK)(?:\s+CLASS)?"], (0.1, 0.5, 0.9, 0.7)),
                TicketField("price", [r"(?:Price|Cost|Fare)[:\s]*£?([0-9]+\.[0-9]{2})", r"£([0-9]+\.[0-9]{2})"], (0.7, 0.7, 0.95, 0.9)),
                TicketField("ticket_reference", [r"(?:Reference|Ref)[:\s]*([A-Z0-9-]+)", r"([A-Z0-9]{2,}-[A-Z0-9]{2,}-[A-Z0-9]{2,})"], (0.4, 0.8, 0.9, 0.95)),
            ],
            
            "gwr": [
                TicketField("origin_station", [r"FROM\s+(.+?)(?:\s+TO|\s*$|[,\.])", r"(?:From|Origin)[:\s]+(.+?)(?:\s+to|\s*$|[,\.])"], (0.05, 0.2, 0.45, 0.3)),
                TicketField("destination_station", [r"TO\s+(.+?)(?:\s*$|[,\.])", r"(?:To|Destination)[:\s]+(.+?)(?:\s*$|[,\.])"], (0.55, 0.2, 0.95, 0.3)),
                TicketField("date", [r"VALID\s+(?:ON|FOR)\s+(.+?)(?:\s*$|[,\.])", r"(?:Date|Valid)[:\s]+(.+?)(?:\s*$|[,\.])"], (0.1, 0.3, 0.9, 0.4)),
                TicketField("ticket_type", [r"(STANDARD|FIRST)\s+CLASS", r"(ANYTIME|OFF-PEAK|SUPER OFF-PEAK)"], (0.1, 0.4, 0.9, 0.5)),
                TicketField("price", [r"£([0-9]+\.[0-9]{2})", r"GBP\s+([0-9]+\.[0-9]{2})"], (0.7, 0.7, 0.95, 0.8)),
                TicketField("ticket_reference", [r"TICKET\s+NUMBER\s+([A-Z0-9-]+)", r"REF[:\s]+([A-Z0-9-]+)"], (0.4, 0.8, 0.9, 0.95)),
            ],
            
           #TODO: Add more configurations for other UK rail operators (Southeastern, Northern, etc.)
            "trainline_app": get_trainline_configuration(),
            "generic_digital": get_trainline_configuration()
        }
        
        return configs



if __name__ == "__main__":
    import json
    import argparse
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Train Ticket Parser with ROI Debugging')
    parser.add_argument('image_path', help='Path to the ticket image file')
    parser.add_argument('--debug-roi', action='store_true', help='Enable ROI debugging and save images')
    parser.add_argument('--debug-dir', default='debug_roi_images', help='Directory to save ROI debug images')
    
    # Parse arguments
    args = parser.parse_args()
    try:
        # Pass the debug settings to the TicketScanner
        ticket = TicketScanner(debug_roi=args.debug_roi, debug_dir=args.debug_dir)
        results = ticket.scan(args.image_path)
        # Convert results to JSON and print to stdout

        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({"error": str(e)}))