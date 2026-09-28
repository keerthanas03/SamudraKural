from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.models.boat import Boat
from app.schemas.boat import BoatCreate, BoatResponse
from app.api.deps import get_current_fisherman

router = APIRouter(prefix="/boats", tags=["Boats"])

@router.post("", response_model=BoatResponse, status_code=status.HTTP_201_CREATED)
async def create_boat(
    boat_in: BoatCreate,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> BoatResponse:
    db_boat = Boat(
        fisherman_id=current_user.id,
        name=boat_in.name,
        registration_number=boat_in.registration_number,
        boat_type=boat_in.boat_type,
    )
    db.add(db_boat)
    await db.flush()
    res_boat = BoatResponse.model_validate(db_boat)
    await db.commit()

    return res_boat

@router.get("/{boat_id}", response_model=BoatResponse)
async def get_boat(
    boat_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> BoatResponse:
    result = await db.execute(select(Boat).where(Boat.id == boat_id))
    db_boat = result.scalar_one_or_none()
    if not db_boat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Boat not found")

    if db_boat.fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this boat"
        )

    return BoatResponse.model_validate(db_boat)
