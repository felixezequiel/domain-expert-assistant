import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { Layout } from "./components/Layout.tsx";
import { RequireAuth } from "./components/RequireAuth.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage.tsx";
import { UsersPage } from "./pages/admin/UsersPage.tsx";
import { CollectionsPage } from "./pages/admin/CollectionsPage.tsx";
import { TagsPage } from "./pages/admin/TagsPage.tsx";
import { CredentialsPage } from "./pages/admin/CredentialsPage.tsx";
import { PolicyPage } from "./pages/admin/PolicyPage.tsx";
import { ItemsListPage } from "./pages/curator/ItemsListPage.tsx";
import { ItemEditorPage } from "./pages/curator/ItemEditorPage.tsx";
import { UploadPage } from "./pages/curator/UploadPage.tsx";
import { VersionHistoryPage } from "./pages/curator/VersionHistoryPage.tsx";
import { ReviewQueuePage } from "./pages/reviewer/ReviewQueuePage.tsx";
import { ReviewDetailPage } from "./pages/reviewer/ReviewDetailPage.tsx";
import { AuditTrailPage } from "./pages/auditor/AuditTrailPage.tsx";
import { SearchPage } from "./pages/consumer/SearchPage.tsx";
import { CatalogPage } from "./pages/consumer/CatalogPage.tsx";
import { ItemReadPage } from "./pages/consumer/ItemReadPage.tsx";

// HashRouter is mandatory: the monolith's static server has no SPA history fallback, so
// every client route lives in the URL hash (e.g. /#/admin/users). The server only ever
// serves "/", "/index.html", and "/assets/*" (see SpaController).
export function App(): JSX.Element {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invitations/:token" element={<AcceptInvitationPage />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/search" element={<SearchPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/catalog/:itemId" element={<ItemReadPage />} />

            <Route path="/items" element={<ItemsListPage />} />
            <Route path="/items/new" element={<ItemEditorPage />} />
            <Route path="/items/:itemId" element={<ItemEditorPage />} />
            <Route path="/items/:itemId/versions" element={<VersionHistoryPage />} />
            <Route path="/upload" element={<UploadPage />} />

            <Route path="/review" element={<ReviewQueuePage />} />
            <Route path="/review/:itemId" element={<ReviewDetailPage />} />

            <Route path="/audit" element={<AuditTrailPage />} />

            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/collections" element={<CollectionsPage />} />
            <Route path="/admin/tags" element={<TagsPage />} />
            <Route path="/admin/credentials" element={<CredentialsPage />} />
            <Route path="/admin/policy" element={<PolicyPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
