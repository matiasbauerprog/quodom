import { useRef, useState } from 'react';
import { EXTENSIONES_PERMITIDAS, MAX_FILE_MB, leerArchivo, type ListaEntrada } from '../../api/lista';

export function CargarLista({
  onEnviar,
  ocupado = false
}: {
  onEnviar: (entrada: ListaEntrada) => void;
  ocupado?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function extension(nombre: string) {
    const i = nombre.lastIndexOf('.');
    return i === -1 ? '' : nombre.slice(i).toLowerCase();
  }

  // Se valida acá y no sólo en el server: así el usuario se entera al instante
  // en vez de esperar la subida entera para recibir un 400.
  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!EXTENSIONES_PERMITIDAS.includes(extension(file.name))) {
      setError('Ese formato no se puede leer. Subí un Excel, un CSV, una foto o un PDF.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError('El archivo supera los ' + MAX_FILE_MB + ' MB. Probá con uno más liviano.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      const archivo = await leerArchivo(file);
      onEnviar({ tipo: 'archivo', archivo });
    } catch {
      setError('No se pudo leer el archivo. Probá de nuevo.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function enviarTexto() {
    const limpio = texto.trim();
    if (!limpio) return;
    setError(null);
    onEnviar({ tipo: 'texto', texto: limpio });
  }

  return (
    <section className="cl card hoja">
      <p className="cl-ayuda">
        Subí tu lista en Excel, una foto o un PDF, o pegala como texto. Busco cada ítem en el catálogo.
      </p>

      <label className="cl-label" htmlFor="cl-archivo">Subí un archivo</label>
      <input
        id="cl-archivo"
        ref={fileRef}
        type="file"
        className="cl-file"
        accept={EXTENSIONES_PERMITIDAS.join(',')}
        onChange={onArchivo}
        disabled={ocupado}
      />

      <label className="cl-label" htmlFor="cl-texto">Pegá tu lista</label>
      <textarea
        id="cl-texto"
        className="input cl-texto"
        rows={6}
        placeholder={'3 lavandinas 5L\n2 resmas A4\n1 pack de agua'}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        disabled={ocupado}
      />

      {error && <p className="cl-error" role="alert">{error}</p>}

      <button
        type="button"
        className="btn btn-exito cl-enviar"
        onClick={enviarTexto}
        disabled={ocupado}
      >
        {ocupado ? 'Buscando…' : 'Buscar en el catálogo'}
      </button>
    </section>
  );
}
