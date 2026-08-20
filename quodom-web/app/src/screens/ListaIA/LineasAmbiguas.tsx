import type { ListaAmbigua, ListaCandidato } from '../../api/lista';

// Presentacional a propósito: no guarda estado ni sabe a qué grupo va cada
// línea. Avisa qué tocó el usuario y el panel decide qué hacer con eso.
export function LineasAmbiguas({
  lineas,
  onElegir,
  onDescartar
}: {
  lineas: ListaAmbigua[];
  onElegir: (linea: ListaAmbigua, candidato: ListaCandidato) => void;
  onDescartar: (linea: ListaAmbigua) => void;
}) {
  if (lineas.length === 0) return null;

  return (
    <section className="amb card hoja" aria-labelledby="amb-titulo">
      <h2 id="amb-titulo" className="amb-titulo">
        Tenés que elegir — {lineas.length}{' '}
        {lineas.length === 1 ? 'línea' : 'líneas'}
      </h2>
      <p className="amb-ayuda">
        Encontré más de un producto para estos renglones. Elegí cuál querés y va a ir al Quodom
        del rubro que corresponda.
      </p>

      <ul className="amb-lista">
        {lineas.map(linea => (
          <li key={linea.textoOriginal} className="amb-item">
            <p className="amb-original">
              <strong>{linea.textoOriginal}</strong>
            </p>

            <div className="amb-candidatos">
              {linea.candidatos.map(c => (
                <button
                  key={c.idproducto}
                  type="button"
                  className="amb-candidato"
                  onClick={() => onElegir(linea, c)}
                >
                  <span className="amb-candidato-nombre">{c.nombreProducto}</span>
                  <span className="amb-candidato-rubro">{c.rubro}</span>
                  {c.idproducto === linea.sugerido && (
                    <span className="amb-sugerido">sugerido</span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-ghost amb-descartar"
              onClick={() => onDescartar(linea)}
            >
              Descartar este renglón
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
