import { Navigate, useLocation } from "react-router-dom";

const getSafeRedirect = (search: string) => {
  const redirect = new URLSearchParams(search).get("__redirect");

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return null;
  }

  return redirect;
};

const Index = () => {
  const { search } = useLocation();
  const redirectPath = getSafeRedirect(search);

  return <Navigate to={redirectPath ?? "/login"} replace />;
};

export default Index;
