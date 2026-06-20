import { Navigate, useParams } from "react-router-dom";

export default function ServiceRedirect() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/services-proximite" replace />;
  }

  return <Navigate to={`/services-proximite/${id}`} replace />;
}
