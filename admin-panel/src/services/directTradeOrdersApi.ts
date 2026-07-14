/*
 Author : CiberMandi Development Team
 Date : 2026-07-14
 Description : Encrypted Admin Direct Trade order monitoring client.

 Major Methods
 - listDirectTradeOrders: Loads paginated filtered orders.
 - getDirectTradeOrderDetails: Loads one order and paginated audit activity.
*/
import { postEncrypted } from './sharedEncryptedRequest';
import { DEFAULT_LANGUAGE } from '../config/appConfig';
export async function listDirectTradeOrders({username,language=DEFAULT_LANGUAGE,page=1,limit=20,status='ALL',search=''}:{username:string;language?:string;page?:number;limit?:number;status?:string;search?:string}){const r=await postEncrypted('/admin/direct-trade/orders/list',{api:'listAdminDirectTradeOrders',username,language,page,limit,status,search});return r?.data||r;}
export async function getDirectTradeOrderDetails({username,language=DEFAULT_LANGUAGE,order_id,audit_page=1,audit_limit=20}:{username:string;language?:string;order_id:string;audit_page?:number;audit_limit?:number}){const r=await postEncrypted('/admin/direct-trade/orders/details',{api:'getAdminDirectTradeOrderDetails',username,language,order_id,audit_page,audit_limit});return r?.data||r;}
