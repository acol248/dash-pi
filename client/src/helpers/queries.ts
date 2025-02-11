const checkAuth = async () => {
  try {
    const res = await fetch("/api/auth", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error("Failed to fetch");

    return true;
  } catch (err) {
    return false;
  }
};

export { checkAuth };