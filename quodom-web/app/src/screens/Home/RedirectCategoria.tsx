import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';

// El catálogo vivía en /categoria/:id y /subcategoria/:id. La app está
// deployada, así que esas URLs siguen existiendo como redirect al home.
export function RedirectRubro() {
  const { id = '' } = useParams();
  return <Navigate to={'/?rubro=' + encodeURIComponent(id)} replace />;
}

export function RedirectSubcategoria() {
  const { id = '' } = useParams();
  // La URL vieja no dice a qué rubro pertenece la subcategoría: hay que
  // preguntarlo. Si no se puede, el home vacío es mejor que una pantalla rota.
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    categorias.porId(Number(id))
      .then(c => { if (alive) setDestino('/?rubro=' + c.idcategoriapadre + '&sub=' + c.id); })
      .catch(() => { if (alive) setDestino('/'); });
    return () => { alive = false; };
  }, [id]);

  if (!destino) return null;
  return <Navigate to={destino} replace />;
}
