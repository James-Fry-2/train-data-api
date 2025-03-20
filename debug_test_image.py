# debug_image_test.py
import cv2
import numpy as np
import os
import sys

# Create a test directory
debug_dir = sys.argv[1] if len(sys.argv) > 1 else "debug_test"
abs_debug_dir = os.path.abspath(debug_dir)

print(f"Creating directory: {abs_debug_dir}")
os.makedirs(abs_debug_dir, exist_ok=True)

# Create a simple test image
test_img = np.ones((300, 400, 3), dtype=np.uint8) * 255  # White background
cv2.rectangle(test_img, (50, 50), (350, 250), (0, 0, 255), 5)  # Red rectangle
cv2.putText(test_img, "Test Image", (100, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)

# Save using cv2.imwrite
test_path = os.path.join(abs_debug_dir, "test_cv2.jpg")
print(f"Saving image to: {test_path}")
result = cv2.imwrite(test_path, test_img)
print(f"CV2 result: {result}")

# Save using PIL as fallback
try:
    from PIL import Image
    pil_img = Image.fromarray(cv2.cvtColor(test_img, cv2.COLOR_BGR2RGB))
    pil_path = os.path.join(abs_debug_dir, "test_pil.jpg")
    print(f"Saving PIL image to: {pil_path}")
    pil_img.save(pil_path)
    print("PIL save successful")
except Exception as e:
    print(f"PIL error: {e}")

# List files in directory
try:
    files = os.listdir(abs_debug_dir)
    print(f"Files in directory: {files}")
except Exception as e:
    print(f"Error listing directory: {e}")