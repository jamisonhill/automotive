import { notFound } from "next/navigation";

import { updateVehicle } from "@/app/actions/vehicles";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/vehicle-form";
import { getVehicle } from "@/lib/queries";

/*
 * Edit an existing vehicle.
 * `bind` creates a curried server action with the vehicle id baked in,
 * so the FormData submitted from the client only carries the user fields.
 */
export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  // .bind on a server action prepends the bound arg(s) to the FormData call.
  // The first arg here (null) is `this`; second is the vehicle id.
  const boundAction = updateVehicle.bind(null, vehicle.id);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit vehicle"
        subtitle={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        backHref={`/vehicles/${vehicle.id}`}
      />
      <VehicleForm
        action={boundAction}
        defaults={vehicle}
        submitLabel="Save changes"
      />
    </main>
  );
}
