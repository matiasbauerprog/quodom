import { apiFetch } from './client';

export type ListaItem = {
  textoOriginal: string;
  idproducto: number;
  nombreProducto: string;
  cantidad: number;
};

export type ListaGrupo = {
  idrubro: number;
  rubro: string;
  items: ListaItem[];
};

export type ListaNoEncontrado = {
  textoOriginal: string;
  motivo: string;
};

export type ListaCandidato = {
  idproducto: number;
  nombreProducto: string;
  idrubro: number;
  rubro: string;
};

export type ListaAmbigua = {
  textoOriginal: string;
  cantidad: number;
  sugerido: number;
  candidatos: ListaCandidato[];
};

export type ListaResponse = {
  res: true;
  grupos: ListaGrupo[];
  ambiguas: ListaAmbigua[];
  noEncontrados: ListaNoEncontrado[];
  lineasIgnoradas: number;
};

export type ListaEntrada =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'archivo'; archivo: { nombre: string; mime: string; datosBase64: string } };

export const EXTENSIONES_PERMITIDAS = ['.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png', '.pdf'];
export const MAX_FILE_MB = 5;

// El archivo viaja como base64 adentro del JSON: express.json ya acepta 50mb y
// así el server no necesita multer ni escribir nada a disco.
export function leerArchivo(file: File): Promise<{ nombre: string; mime: string; datosBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const coma = result.indexOf(',');
      resolve({
        nombre: file.name,
        mime: file.type,
        datosBase64: coma === -1 ? result : result.slice(coma + 1)
      });
    };
    reader.readAsDataURL(file);
  });
}

export const listaApi = {
  procesar: (entrada: ListaEntrada) =>
    apiFetch<ListaResponse>('/api/ia/lista', { method: 'POST', body: entrada })
};
