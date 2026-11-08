import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleMarketingLeadsLoader, handleMarketingLeadsAction } from "../backend/endpoints/marketingLeadsEndpoint";

export async function loader(args: LoaderFunctionArgs) {
  return handleMarketingLeadsLoader(args);
}

export async function action(args: ActionFunctionArgs) {
  return handleMarketingLeadsAction(args);
}
