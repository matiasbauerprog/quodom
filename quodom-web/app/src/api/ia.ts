import { apiFetch } from './client';

export type IaMessage = { role: 'user' | 'assistant'; text: string };

// `nombreAtributoN` es el nombre del grupo ("LITROS") y `atributoN` el valor
// elegido ("20 litros"); `opcionesAtributoN` son los valores que ofrece el
// catálogo para ese producto. Los tres van juntos o no va ninguno: un producto
// sin atributos no los trae. Un `atributoN` en null es válido — la línea entra
// sin atributo y se completa en el detalle del Quodom.
export type IaProposalItem = {
  idproducto: number;
  cantidad: number;
  motivo: string;
  nombreProducto: string;
  nombreAtributo1?: string;
  atributo1?: string | null;
  opcionesAtributo1?: string[];
  nombreAtributo2?: string;
  atributo2?: string | null;
  opcionesAtributo2?: string[];
};

export type IaResponse =
  | { type: 'question'; text: string }
  | { type: 'proposal'; text: string; items: IaProposalItem[]; idrubro: number };

export const iaApi = {
  chat: (messages: IaMessage[]) =>
    apiFetch<IaResponse>('/api/ia/chat', { method: 'POST', body: { messages } })
};
