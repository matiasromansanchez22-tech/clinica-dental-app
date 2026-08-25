import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
      <h1 className="text-3xl font-bold text-gray-900">
        Sistema de Gestión — Clínica Dental Marianela Ramírez
      </h1>
      <p className="text-gray-600">
        Esta es la nueva aplicación, en construcción. Empezamos por lo más usado
        en el día a día: la Agenda de Odontología General.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/agenda"
          className="w-fit rounded-md bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-700"
        >
          Ir a la Agenda de Odontología General →
        </Link>
        <Link
          href="/pacientes"
          className="w-fit rounded-md border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Ir a Alta de Pacientes →
        </Link>
      </div>
    </main>
  );
}
