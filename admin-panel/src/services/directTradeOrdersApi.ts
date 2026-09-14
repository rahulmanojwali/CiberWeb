/*
 Author : CiberMandi Development Team
 Date : 2026-09-14
 Description : Encrypted Admin Direct Trade order monitoring client.
*/
import { postEncrypted } from './sharedEncryptedRequest';
import { DEFAULT_LANGUAGE } from '../config/appConfig';

export type DirectTradeOrderListParams = {
  username: string;
  language?: string;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export type DirectTradeOrderDetailParams = {
  username: string;
  language?: string;
  order_id: string;
  audit_page?: number;
  audit_limit?: number;
};

export async function listDirectTradeOrders({
  username,
  language = DEFAULT_LANGUAGE,
  page = 1,
  limit = 25,
  status = 'ALL',
  search = '',
}: DirectTradeOrderListParams) {
  const response = await postEncrypted('/admin/direct-trade/orders/list', {
    api: 'listAdminDirectTradeOrders',
    username,
    language,
    page,
    limit,
    status,
    search,
  });
  return response?.data || response;
}

export async function getDirectTradeOrderDetails({
  username,
  language = DEFAULT_LANGUAGE,
  order_id,
  audit_page = 1,
  audit_limit = 20,
}: DirectTradeOrderDetailParams) {
  const response = await postEncrypted('/admin/direct-trade/orders/details', {
    api: 'getAdminDirectTradeOrderDetails',
    username,
    language,
    order_id,
    audit_page,
    audit_limit,
  });
  return response?.data || response;
}
