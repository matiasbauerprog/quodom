import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FilaProveedor } from './FilaProveedor';
import { useProveedores } from './useProveedores';
import './DialogoProveedores.css';

type Props = {
  idquodom: string;
  onCerrar: () => void;
  /**
   * Avisa que el Quodom salió, por cualquiera de los dos caminos: el proveedor
   * elegido y el pie sin destinatario. Los dos lo pasan a ENVIADO, así que los
   * dos tienen que disparar el refresco del árbol y de la barra inferior;
   * avisar sólo en uno dejaba al Quodom figurando en armado después de salir.
   * Y no cierra el diálogo: mandarle a varios proveedores es para lo que existe.
   */
  onEnviado?: () => void;
  /** Avisa que el Quodom salió sin destinatario, para que quien abrió el diálogo cierre y refresque. */
  onEnviadoSinProveedor?: () => void;
};

/**
 * Los proveedores cerca del Quodom, en el momento de enviarlo.
 *
 * La regla que manda acá: **una falla de la búsqueda no puede dejar al comprador
 * sin enviar**. "Enviar sin elegir proveedor" está en los tres estados —con
 * lista, con lista vacía y con la búsqueda caída— porque antes de este feature
 * el comprador siempre podía enviar, y eso no lo puede romper una API ajena.
 *
 * Los datos y las acciones viven en `useProveedores`, y el renglón en
 * `FilaProveedor`: los comparte con la sección del Quodom ya enviado.
 */
export function DialogoProveedores({ idquodom, onCerrar, onEnviado, onEnviadoSinProveedor }: Props) {
  const {
    datos, cargando, error, errorEnvio, ocupado,
    preguntandoMotivo, setPreguntandoMotivo, enviarA, enviarSinProveedor, deshacer
  } = useProveedores(idquodom, { onEnviado, onEnviadoSinProveedor });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, ocupado]);

  function cerrar() {
    if (ocupado) return;
    onCerrar();
  }

  return (
    <div className="dp-backdrop" onClick={cerrar}>
      <section
        className="dp card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dp-titulo" className="dp-titulo">
          {datos?.desde ? 'Proveedores cerca de ' + datos.desde : 'Proveedores cerca'}
        </h2>

        {datos && !datos.preciso && (
          <p className="dp-aprox">
            Tu dirección no está ubicada con precisión — las distancias son desde el centro de la localidad.{' '}
            {/* Un Link y no un href: un ancla recarga el documento entero en
                medio de un envío y se lleva el Quodom a medio mandar. */}
            <Link to="/direcciones">Revisá tu dirección</Link>
          </p>
        )}

        {cargando && (
          // Esqueleto y no spinner: la forma de la lista ya se conoce, y un
          // spinner centrado la colapsa a una línea y la devuelve, que se lee
          // como una recarga de toda la pantalla.
          <ul className="dp-lista" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <li key={i} className="dp-prov dp-prov-esqueleto">
                <span className="dp-linea esqueleto" />
                <span className="dp-linea dp-linea-corta esqueleto" />
                <span className="dp-boton-esqueleto esqueleto" />
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="dp-error" role="alert">No pudimos buscar proveedores cerca. {error}</p>
        )}

        {!cargando && !error && datos && datos.proveedores.length === 0 && (
          <p className="dp-vacio">No encontramos proveedores de este rubro cerca de tu dirección.</p>
        )}

        {!cargando && datos && datos.proveedores.length > 0 && (
          <ul className="dp-lista">
            {datos.proveedores.map(p => (
              <li key={p.placeid}>
                <FilaProveedor
                  proveedor={p}
                  ocupado={ocupado === p.placeid}
                  preguntandoMotivo={preguntandoMotivo === p.placeid}
                  onEnviar={() => enviarA(p)}
                  onPreguntarMotivo={() => setPreguntandoMotivo(p.placeid)}
                  onCancelarMotivo={() => setPreguntandoMotivo(null)}
                  onDeshacer={motivo => deshacer(p, motivo)}
                />
              </li>
            ))}
          </ul>
        )}

        {errorEnvio && <p className="dp-error" role="alert">{errorEnvio}</p>}

        <div className="dp-pie">
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={enviarSinProveedor}
            disabled={ocupado === 'sin-proveedor'}
          >
            {ocupado === 'sin-proveedor' ? 'Abriendo WhatsApp…' : 'Enviar sin elegir proveedor'}
          </button>
          <button type="button" className="dp-cerrar" onClick={cerrar} disabled={!!ocupado}>Cerrar</button>
        </div>

        {/* La atribución es una exigencia de los términos de Google, no un adorno. */}
        {datos && <p className="dp-atribucion">{datos.atribucion}</p>}
      </section>
    </div>
  );
}
