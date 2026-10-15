import { FilaProveedor } from './FilaProveedor';
import { useProveedores } from './useProveedores';
import './ProveedoresContactados.css';

/**
 * A quién le llegó un Quodom ya enviado, y los que faltan.
 *
 * Existe porque enviar no termina el trabajo: el comprador le manda a uno, no
 * le contestan, y le manda a otro. Sin esta sección el único lugar donde se veía
 * a quién ya le había mandado era el selector del envío, que se cierra; y a quién
 * le mandó sólo lo sabe el servidor, así que el que volvía al otro día no tenía
 * forma de saberlo y arrancaba de nuevo.
 *
 * El renglón y las acciones son los mismos del selector (`FilaProveedor` y
 * `useProveedores`): acá no hay una segunda versión de "mandarle a un proveedor".
 */
export function ProveedoresContactados({ idquodom }: { idquodom: string }) {
  const {
    datos, cargando, error, avisoRecarga, errorEnvio, ocupado,
    preguntandoMotivo, setPreguntandoMotivo, enviarA, deshacer
  } = useProveedores(idquodom);

  const lista = datos?.proveedores ?? [];
  const contactados = lista.filter(p => p.contactadoen).length;

  return (
    <section className="pc" aria-labelledby="pc-titulo">
      <h2 id="pc-titulo" className="pc-titulo">Proveedores contactados</h2>

      {cargando && <p className="pc-cuenta">Buscando proveedores cerca…</p>}

      {error && (
        <p className="pc-error" role="alert">No pudimos buscar proveedores cerca. {error}</p>
      )}

      {avisoRecarga && (
        <p className="pc-aviso" role="status">
          No pudimos actualizar la lista, así que seguís viendo la de hace un momento. {avisoRecarga}
        </p>
      )}

      {!cargando && !error && lista.length === 0 && (
        <p className="pc-cuenta">No encontramos proveedores de este rubro cerca de tu dirección.</p>
      )}

      {lista.length > 0 && (
        <>
          {/* La cuenta primero: es lo que contesta "¿ya le mandé a alguien?" sin
              leer la lista entera. */}
          <p className="pc-cuenta">Le mandaste a {contactados} de {lista.length}.</p>
          <ul className="pc-lista">
            {lista.map(p => (
              <li key={p.placeid}>
                <FilaProveedor
                  proveedor={p}
                  ocupado={ocupado === p.placeid}
                  preguntandoMotivo={preguntandoMotivo === p.placeid}
                  // Acá no: "No tiene WhatsApp" escribe un dato global y
                  // permanente sobre el comercio, y desde el historial es un
                  // recuerdo y no lo que el comprador acaba de ver (ver
                  // FilaProveedor). "Volver a enviar" y los que faltan sí,
                  // que es para lo que existe esta sección.
                  permiteDeshacer={false}
                  onEnviar={() => enviarA(p)}
                  onPreguntarMotivo={() => setPreguntandoMotivo(p.placeid)}
                  onDeshacer={motivo => deshacer(p, motivo)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {errorEnvio && <p className="pc-error" role="alert">{errorEnvio}</p>}

      {/* La atribución es una exigencia de los términos de Google, no un adorno. */}
      {datos && <p className="pc-atribucion">{datos.atribucion}</p>}
    </section>
  );
}
