import { apiFetch } from './client';

export type IaMessage = { role: 'user' | 'assistant'; text: string };

export type IaProposalItem = {
  idproducto: number;
  cantidad: number;
  motivo: string;
  nombreProducto: string;
};

export type IaResponse =
  | { type: 'question'; text: string }
  | { type: 'proposal'; text: string; items: IaProposalItem[]; idrubro: number };

export const iaApi = {
  chat: (messages: IaMessage[]) =>
    apiFetch<IaResponse>('/api/ia/chat', { method: 'POST', body: { messages } })
};
