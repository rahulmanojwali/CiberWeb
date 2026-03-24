export const getScreenHelp = async ({ username, language, payload }: { username: string; language: string; payload: any }) => {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    const token = parsed?.token || "";

    const baseUrl = process.env.REACT_APP_API_BASE_URL || "";

    const response = await fetch(`${baseUrl}/api/admin/getScreenHelp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Accept-Language": language || "en",
      },
      body: JSON.stringify({
        items: {
          api: "getScreenHelp",
          ...payload,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[screenHelpApi] Error fetching screen help:", error);
    throw error;
  }
};