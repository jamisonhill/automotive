import { createVehicle } from "@/app/actions/vehicles";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/vehicle-form";

/*
 * Add a new vehicle. The form is a server-action <form>, so submission
 * runs createVehicle on the server, then redirects to the detail page.
 */
export default function NewVehiclePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader title="Add vehicle" backHref="/" backLabel="Garage" />
      <VehicleForm action={createVehicle} submitLabel="Save vehicle" />
    </main>
  );
}
