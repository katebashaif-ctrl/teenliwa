import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleSettingsLoader, handleSettingsAction } from "../backend/endpoints/settingsEndpoint";

export async function loader(args: LoaderFunctionArgs) {
  return handleSettingsLoader(args);
}

export async function action(args: ActionFunctionArgs) {
  return handleSettingsAction(args);
}
