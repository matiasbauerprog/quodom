const XLSX = require('xlsx');
const { normalizar, EntradaInvalida } = require('../src/helpers/listaEntrada');

function planillaBase64(filas, bookType) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  return XLSX.write(wb, { type: 'buffer', bookType: bookType || 'xlsx' }).toString('base64');
}

function archivo(nombre, mime, datosBase64) {
  return { tipo: 'archivo', archivo: { nombre, mime, datosBase64 } };
}

describe('normalizar: texto pegado', () => {
  it('parte el texto en líneas y las manda como un solo part', () => {
    const out = normalizar({ tipo: 'texto', texto: '3 lavandinas 5L\n\n  2 resmas A4  ' }, 150);
    expect(out.lineas).toEqual(['3 lavandinas 5L', '2 resmas A4']);
    expect(out.parts).toEqual([{ text: '3 lavandinas 5L\n2 resmas A4' }]);
    expect(out.ignoradas).toBe(0);
  });

  it('rechaza el texto vacío', () => {
    expect(() => normalizar({ tipo: 'texto', texto: '   \n  ' }, 150))
      .toThrow(expect.objectContaining({ codigo: 'lista_vacia' }));
  });

  it('recorta a maxLineas e informa cuántas quedaron afuera', () => {
    const texto = Array.from({ length: 5 }, (_, i) => 'item ' + i).join('\n');
    const out = normalizar({ tipo: 'texto', texto }, 3);
    expect(out.lineas).toHaveLength(3);
    expect(out.ignoradas).toBe(2);
  });
});

describe('normalizar: planilla', () => {
  it('convierte cada fila del xlsx en una línea de texto', () => {
    const b64 = planillaBase64([['Cantidad', 'Producto'], [3, 'Lavandina 5L'], [2, 'Resma A4']]);
    const out = normalizar(archivo('lista.xlsx', 'application/vnd.ms-excel', b64), 150);
    expect(out.lineas).toEqual(['Cantidad Producto', '3 Lavandina 5L', '2 Resma A4']);
  });

  it('acepta csv', () => {
    const b64 = planillaBase64([[3, 'Lavandina 5L']], 'csv');
    const out = normalizar(archivo('lista.csv', 'text/csv', b64), 150);
    expect(out.lineas).toEqual(['3 Lavandina 5L']);
  });

  it('salta las celdas vacías de una fila', () => {
    const b64 = planillaBase64([[3, '', 'Lavandina 5L']]);
    const out = normalizar(archivo('lista.xlsx', '', b64), 150);
    expect(out.lineas).toEqual(['3 Lavandina 5L']);
  });

  // Un .xlsx real es un ZIP: el fixture es un ZIP truncado, no texto plano.
  // Con texto plano `xlsx` no falla — lo interpreta como CSV de una fila.
  it('lanza archivo_ilegible con un xlsx corrupto', () => {
    const zipRoto = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]).toString('base64');
    expect(() => normalizar(archivo('lista.xlsx', '', zipRoto), 150))
      .toThrow(expect.objectContaining({ codigo: 'archivo_ilegible' }));
  });
});

describe('normalizar: imagen y PDF', () => {
  it('manda la imagen como inlineData y deja lineas en null', () => {
    const out = normalizar(archivo('foto.jpg', 'image/jpeg', 'QUJD'), 150);
    expect(out.lineas).toBeNull();
    expect(out.ignoradas).toBe(0);
    expect(out.parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    expect(typeof out.parts[1].text).toBe('string');
  });

  it('deduce el mimeType del PDF por la extensión', () => {
    const out = normalizar(archivo('remito.PDF', '', 'QUJD'), 150);
    expect(out.parts[0].inlineData.mimeType).toBe('application/pdf');
  });
});

describe('normalizar: formatos y tamaño', () => {
  it('rechaza una extensión no soportada', () => {
    expect(() => normalizar(archivo('lista.docx', '', 'QUJD'), 150))
      .toThrow(expect.objectContaining({ codigo: 'formato_no_soportado' }));
  });

  it('rechaza un archivo más grande que el máximo', () => {
    const grande = Buffer.alloc(6 * 1024 * 1024).toString('base64');
    expect(() => normalizar(archivo('foto.jpg', 'image/jpeg', grande), 150))
      .toThrow(expect.objectContaining({ codigo: 'archivo_muy_grande' }));
  });

  it('rechaza un body sin texto ni archivo', () => {
    expect(() => normalizar({ tipo: 'texto' }, 150))
      .toThrow(expect.objectContaining({ codigo: 'lista_vacia' }));
  });
});
