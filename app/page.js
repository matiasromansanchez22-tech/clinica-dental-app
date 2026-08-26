import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-10 text-center">
      <Image src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" width={220} height={220} priority />
      <h1 className="text-3xl font-semibold text-brand-brown">
        Sistema de Gestión — Clínica Dental Marianela Ramírez
      </h1>
      <p className="text-brand-charcoal/70">
        Esta es la nueva aplicación, en construcción. Empezamos por lo más usado
        en el día a día: la Agenda de Odontología General.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/agenda"
          className="w-fit rounded-md bg-brand-brown px-5 py-3 font-medium text-brand-cream hover:bg-brand-brown-dark"
        >
          Ir a la Agenda de Odontología General →
        </Link>
        <Link
          href="/pacientes"
          className="w-fit rounded-md border border-brand-brown/40 px-5 py-3 font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          Ir a Alta de Pacientes →
        </Link>
      </div>
    </main>
  );
}
