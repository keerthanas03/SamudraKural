from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.models.boat import Boat
from app.models.location import FishingLocation
from app.schemas.fisherman import FishermanResponse
from app.schemas.boat import BoatResponse
from app.schemas.location import FishingLocationResponse
from app.services.spatial import spatial_to_location_point
from app.api.deps import get_current_fisherman

router = APIRouter(prefix="/fishermen", tags=["Fishermen"])

@router.get("/{fisherman_id}", response_model=FishermanResponse)
async def get_fisherman(
    fisherman_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> FishermanResponse:
    if fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access another fisherman's data"
        )

    return FishermanResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        is_active=current_user.is_active,
        shore_location=spatial_to_location_point(current_user.shore_location),
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )

@router.get("/{fisherman_id}/boat", response_model=BoatResponse)
async def get_fisherman_boat(
    fisherman_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> BoatResponse:
    if fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access another fisherman's boat"
        )

    boat_result = await db.execute(select(Boat).where(Boat.fisherman_id == current_user.id))
    db_boat = boat_result.scalars().first()
    if not db_boat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No boat found for this fisherman")

    return BoatResponse.model_validate(db_boat)

@router.get("/{fisherman_id}/locations", response_model=List[FishingLocationResponse])
async def get_fisherman_locations(
    fisherman_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> List[FishingLocationResponse]:
    if fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access another fisherman's locations"
        )

    loc_result = await db.execute(select(FishingLocation).where(FishingLocation.fisherman_id == current_user.id))
    db_locations = loc_result.scalars().all()

    return [
        FishingLocationResponse(
            id=loc.id,
            fisherman_id=loc.fisherman_id,
            name=loc.name,
            location=spatial_to_location_point(loc.location),
            notes=loc.notes,
            created_at=loc.created_at,
            updated_at=loc.updated_at,
        )
        for loc in db_locations
    ]
