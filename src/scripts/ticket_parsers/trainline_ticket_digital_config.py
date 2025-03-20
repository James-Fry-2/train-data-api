"""
Corrected configuration for Trainline digital tickets based on actual ticket layout.
All region coordinates are properly normalized between 0 and 1.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class TicketField:
    name: str
    patterns: List[str]
    region: Optional[Tuple[float, float, float, float]] = None  # x1, y1, x2, y2 as ratios of width/height


def get_trainline_configuration():
    """
    Returns configuration for Trainline mobile app tickets.
    Regions are defined as (x1, y1, x2, y2) coordinates, expressed as ratios of the image dimensions.
    All values are between 0 and 1.
    """
    return [
        # Title/Header - confirms it's a Trainline ticket
        TicketField(
            name="ticket_provider",
            patterns=[
                r"(Eticket)",
                r"(Trainline)"
            ],
            region=(0.13, 0.12, 0.3, 0.14)  # "Eticket" text in the header
        ),
        
        # Origin station - extract from both the station name and code
        TicketField(
            name="origin_station",
            patterns=[
                r"([A-Za-z\s]+(?::STATIONS)?)",
            ],
            region=(0.0, 0.49, 0.5, 0.53)  # "LIVERPOOL STATIONS" text
        ),
        
        # Origin station code
        TicketField(
            name="origin_code",
            patterns=[
                r"([A-Z]{3})"
            ],
            region=(0, 0.5, 0.46, 0.61) 
        ),
        
        # Destination station
        TicketField(
            name="destination_station",
            patterns=[
                r"([A-Za-z\s]+)"
            ],
            region=(0.5, 0.49, 1, 0.53)  # "GRANTHAM" text
        ),
        
        # Destination station code
        TicketField(
            name="destination_code",
            patterns=[
                r"(GRA)",
                r"([A-Z]{3})"
            ],
            region=(0.5, 0.5, 1, 0.61)   # "GRA" code
        ),
        
        # Travel date
        TicketField(
            name="travel_date",
            patterns=[
                r"(\d{2}\s+[A-Za-z]{3}\s+\d{4})",
                r"08\s+Feb\s+2025"
            ],
            region=(0.22, 0.58, 0.4, 0.6)  # "08 Feb 2025" date
        ),
        
        # Journey direction (outbound/return)
        TicketField(
            name="journey_direction",
            patterns=[
                r"(Ret):\s+[A-Z]{3}\s*-\s*[A-Z]{3}",
                r"Out:\s+[A-Z]{3}\s*-\s*[A-Z]{3}"
            ],
            region=(0.5, 0.35, 1, 0.5)  # "Ret: LVP - GRA" text
        ),
        
        # Ticket type
        TicketField(
            name="ticket_type",
            patterns=[
                r"(Off-Peak|Anytime|Advance|Super Off-Peak)(?:\s+Return|Single)?"
            ],
            region=(0, 0.5, 0.6, 0.8)  # "Off-Peak Return" text
        ),
        
        # Route restrictions
        TicketField(
            name="route",
            patterns=[
                r"(Any Permitted)",
                r"(Not via .+|Via .+|Any Permitted)"
            ],
            region=(0.55, 0.5, 1, 0.8)  # "Any Permitted" text
        ),
        
        # Passenger type
        TicketField(
            name="passenger_type",
            patterns=[
                r"(ADULT)",
                r"(CHILD)"
            ],
            region=(0.06, 0.8, 0.2, 0.83)  # "ADULT" text
        ),
        
        # Railcard
        TicketField(
            name="railcard",
            patterns=[
                r"(26-30 Railcard)",
                r"(\d{2}-\d{2}\s+Railcard)",
                r"([A-Za-z\s\-]+Railcard)"
            ],
            region=(0.06, 0.83, 0.4, 0.85)  # "26-30 Railcard" text
        ),
        
        # Valid until date
        TicketField(
            name="valid_until",
            patterns=[
                r"(\d{2}\s+[A-Za-z]{3}\s+\d{4})",
                r"07\s+Mar\s+2025"
            ],
            region=(0.55, 0.83, 0.94, 0.85)  # "07 Mar 2025" text
        ),
        
        # Ticket reference
        TicketField(
            name="reference",
            patterns=[
                r"(TTF[A-Z0-9]+)",
                r"([A-Z0-9]{9,12})"
            ],
            region=(0.2, 0.51, 0.8, 0.53)  # "TTF7JRT2QVF" reference code
        ),
        
        # Digital ticket indicators (buttons, etc.)
        TicketField(
            name="digital_indicators",
            patterns=[
                r"(Add to Google Wallet)",
                r"(Show Railcard)"
            ],
            region=(0.2, 0.25, 0.8, 0.35)  # Check for wallet button
        )
    ]