from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy domain models.
    Domain models (Fisherman, Boat, Net, etc.) will inherit from this Base in future phases.
    """
    pass
