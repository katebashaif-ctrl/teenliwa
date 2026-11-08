// Compatibility re-exports for existing imports. Private order and payment data lives in D1 v2 only.
export {
  initializeD1Schema,
  getOrdersFromDb,
  createOrderInDb,
  updateOrderStatusInDb,
  updateOrderPaymentInDb,
  deleteOrderFromDb,
} from "./ordersV2Db";
export type { D1DatabaseLike } from "./d1";
