// Compatibility re-exports for existing imports. All catalogue reads and writes now use D1 v2.
export {
  initializeProductsSchema,
  getProductsFromDb,
  createProductInDb,
  updateProductInDb,
  deleteProductFromDb,
  clearAllProductsInDb,
} from "./productsV2Db";
export type { D1DatabaseLike } from "./d1";
