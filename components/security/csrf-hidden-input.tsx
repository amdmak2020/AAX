import { getCsrfTokenForRender } from "@/lib/csrf";

export async function CsrfHiddenInput() {
  const token = await getCsrfTokenForRender();
  return <input name="csrfToken" type="hidden" value={token} />;
}
