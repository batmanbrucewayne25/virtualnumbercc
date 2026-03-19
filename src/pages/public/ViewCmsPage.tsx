import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { getCmsPageBySlug } from "@/hasura/mutations/cms";

const ViewCmsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const resellerIdParam = searchParams.get("reseller_id") || undefined;
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPage = async () => {
      if (!slug) {
        setError("Invalid page");
        setLoading(false);
        return;
      }

      try {
        const result = await getCmsPageBySlug(slug, resellerIdParam ?? null);
        if (result.success && result.data) {
          setPage(result.data);
        } else {
          setError(result.message || "Page not found");
        }
      } catch (err: any) {
        console.error("Failed to fetch CMS page:", err);
        setError("Failed to load page");
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug, resellerIdParam]);

  if (loading) {
    return (
      <section className="auth bg-base d-flex flex-wrap">
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
          <div className="max-w-800-px mx-auto w-100 text-center">
            <p>Loading...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !page) {
    return (
      <section className="auth bg-base d-flex flex-wrap">
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
          <div className="max-w-800-px mx-auto w-100 text-center">
            <h4 className="mb-16">Page Not Found</h4>
            <p className="text-secondary-light mb-24">{error || "The page you are looking for does not exist."}</p>
            <Link to="/sign-up" className="btn btn-primary">
              Go to Sign Up
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth bg-base d-flex flex-wrap">
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
        <div className="max-w-800-px mx-auto w-100">
          {/* Logo */}
          <Link to="/sign-up" className="mb-40 max-w-290-px d-block">
            <img src="assets/images/own/dlogo.png" alt="Logo" />
          </Link>

          {/* Page Title */}
          <h2 className="mb-24">{page.page_title}</h2>

          {/* Page Content */}
          <div 
            className="cms-content"
            dangerouslySetInnerHTML={{ __html: page.content }}
            style={{
              lineHeight: '1.6',
              color: '#333'
            }}
          />

          {/* Back Link */}
          <div className="mt-32">
            {resellerIdParam ? (
              <Link to={`/clienthub/${resellerIdParam}`} className="btn btn-outline-secondary">
                ← Back to Client Hub
              </Link>
            ) : (
              <Link to="/sign-up" className="btn btn-outline-secondary">
                ← Back to Sign Up
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ViewCmsPage;

