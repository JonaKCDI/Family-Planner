"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { selectMileageCar } from "@/lib/actions";

type MileageCarOption = { id: string; name: string; color: string; licensePlate: string; href: string };

export function MileageCarPicker({ cars, selectedCarId }: { cars: MileageCarOption[]; selectedCarId: string }) {
  const router = useRouter();
  return <div className="mileage-car-menu" role="list" aria-label="Autos">
    {cars.map((car) => <Link role="listitem" className={selectedCarId === car.id ? "active" : ""} href={car.href} key={car.id} onClick={async (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      await selectMileageCar(car.id);
      router.push(car.href);
    }}>
      <span className="color-dot" style={{ background: car.color }} />
      <span>
        <strong>{car.name}</strong>
        {car.licensePlate ? <small>{car.licensePlate}</small> : null}
      </span>
    </Link>)}
  </div>;
}
