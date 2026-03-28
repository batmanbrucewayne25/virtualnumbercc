import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill/dist/quill.snow.css";
import {
  getCmsPages,
  createCmsPage,
  updateCmsPage,
} from "@/hasura/mutations/cms";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";

/** Legal CMS pages: fixed titles + slugs (ClientHub / footer links) */
const LEGAL_CMS_PAGE_TYPES = [
  { page_title: "Terms and Conditions", slug: "terms-and-conditions" },
  { page_title: "Privacy Policy", slug: "privacy-policy" },
];

const findPageByLegalType = (pages, meta) =>
  pages.find(
    (p) =>
      p.slug === meta.slug ||
      p.page_title === meta.page_title
  ) ?? null;

/** Only include fields that changed so the API does not overwrite untouched columns */
const buildCmsPageUpdateDiff = (editingPage, formData, isResellerRole, resellerId) => {
  const diff = {};
  const t = (s) => (s ?? "").trim();
  if (t(formData.page_title) !== t(editingPage.page_title)) {
    diff.page_title = formData.page_title.trim();
  }
  if ((formData.content ?? "") !== (editingPage.content ?? "")) {
    diff.content = formData.content;
  }
  if (t(formData.slug) !== t(editingPage.slug)) {
    diff.slug = formData.slug.trim();
  }
  if (!!formData.is_published !== !!editingPage.is_published) {
    diff.is_published = formData.is_published;
  }
  if (!isResellerRole) {
    const next =
      resellerId == null || resellerId === "" ? null : String(resellerId);
    const prev =
      editingPage.reseller_id == null ? null : String(editingPage.reseller_id);
    if (next !== prev) {
      diff.reseller_id = resellerId ?? null;
    }
  }
  return diff;
};

const isHtmlContentEmpty = (html) => {
  if (!html || !String(html).trim()) return true;
  const text = String(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length === 0;
};

const CmsLayer = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [termsContent, setTermsContent] = useState("");
  const [termsPublished, setTermsPublished] = useState(false);
  const [termsPage, setTermsPage] = useState(null);

  const [privacyContent, setPrivacyContent] = useState("");
  const [privacyPublished, setPrivacyPublished] = useState(false);
  const [privacyPage, setPrivacyPage] = useState(null);

  const [savingSection, setSavingSection] = useState(null);

  const userData = getUserData();
  const roleFromToken = (() => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload?.role ?? null;
    } catch {
      return null;
    }
  })();
  const isResellerRole = userData?.role === "reseller" || roleFromToken === "reseller";
  const currentResellerId = isResellerRole ? (userData?.id ?? null) : null;

  const [resellerFilter, setResellerFilter] = useState("admin");
  const [resellers, setResellers] = useState([]);

  const getTargetResellerId = useCallback(() => {
    if (isResellerRole) return currentResellerId;
    if (resellerFilter === "admin") return null;
    return resellerFilter;
  }, [isResellerRole, currentResellerId, resellerFilter]);

  const ownerScopeKey = isResellerRole ? String(currentResellerId ?? "") : resellerFilter;

  useEffect(() => {
    if (!isResellerRole) {
      getMstResellers().then((res) => {
        if (res.success && res.data) setResellers(res.data);
      });
    }
  }, [isResellerRole]);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filter = isResellerRole
        ? { resellerId: currentResellerId }
        : resellerFilter === "admin"
          ? { resellerId: null }
          : { resellerId: resellerFilter };
      const result = await getCmsPages(filter);
      if (result.success) {
        setPages(result.data || []);
      } else {
        setError("Failed to load CMS pages");
      }
    } catch (err) {
      console.error("Error fetching CMS pages:", err);
      setError("An error occurred while loading CMS pages");
    } finally {
      setLoading(false);
    }
  }, [isResellerRole, currentResellerId, resellerFilter]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    const termsMeta = LEGAL_CMS_PAGE_TYPES[0];
    const privacyMeta = LEGAL_CMS_PAGE_TYPES[1];
    const tPage = findPageByLegalType(pages, termsMeta);
    const pPage = findPageByLegalType(pages, privacyMeta);
    setTermsPage(tPage);
    setTermsContent(tPage?.content ?? "");
    setTermsPublished(!!tPage?.is_published);
    setPrivacyPage(pPage);
    setPrivacyContent(pPage?.content ?? "");
    setPrivacyPublished(!!pPage?.is_published);
  }, [pages]);

  const saveSection = async (section) => {
    const meta =
      section === "terms" ? LEGAL_CMS_PAGE_TYPES[0] : LEGAL_CMS_PAGE_TYPES[1];
    const content = section === "terms" ? termsContent : privacyContent;
    const isPublished = section === "terms" ? termsPublished : privacyPublished;
    const editingPage = section === "terms" ? termsPage : privacyPage;

    setError("");
    setSuccess("");

    if (isHtmlContentEmpty(content)) {
      setError(`${meta.page_title}: content is required`);
      return;
    }

    const targetResellerId = getTargetResellerId();
    const formData = {
      page_title: meta.page_title,
      slug: meta.slug,
      content,
      is_published: isPublished,
      reseller_id: targetResellerId,
    };

    setSavingSection(section);
    try {
      let result;
      if (editingPage) {
        const updatePayload = buildCmsPageUpdateDiff(
          editingPage,
          formData,
          isResellerRole,
          targetResellerId
        );
        if (Object.keys(updatePayload).length === 0) {
          setSuccess(`${meta.page_title}: no changes to save`);
          setTimeout(() => setSuccess(""), 2000);
          return;
        }
        result = await updateCmsPage(editingPage.id, updatePayload);
      } else {
        result = await createCmsPage({
          page_title: meta.page_title.trim(),
          content,
          slug: meta.slug.trim(),
          is_published: isPublished,
          reseller_id: targetResellerId,
        });
      }

      if (result.success) {
        setSuccess(
          `${meta.page_title} ${editingPage ? "updated" : "saved"} successfully`
        );
        setTimeout(() => setSuccess(""), 2500);
        await fetchPages();
      } else {
        setError(result.message || `Failed to save ${meta.page_title}`);
      }
    } catch (err) {
      console.error("Error saving CMS page:", err);
      setError("An error occurred while saving");
    } finally {
      setSavingSection(null);
    }
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "link",
    "image",
  ];

  const renderLegalSection = (section) => {
    const meta =
      section === "terms" ? LEGAL_CMS_PAGE_TYPES[0] : LEGAL_CMS_PAGE_TYPES[1];
    const content = section === "terms" ? termsContent : privacyContent;
    const setContent = section === "terms" ? setTermsContent : setPrivacyContent;
    const isPublished = section === "terms" ? termsPublished : privacyPublished;
    const setPublished =
      section === "terms" ? setTermsPublished : setPrivacyPublished;
    const saving = savingSection === section;
    const disabled = saving || loading || (savingSection !== null && savingSection !== section);

    return (
      <div
        className="card border border-neutral-200 radius-12 mb-24"
        key={meta.slug}
      >
        <div className="card-header bg-base border-bottom py-16 px-24">
          <h6 className="text-md text-primary-light mb-0">{meta.page_title}</h6>
          <small className="text-xs text-secondary-light d-block mt-4">
            Slug: <span className="font-monospace">{meta.slug}</span>
          </small>
        </div>
        <div className="card-body p-24">
          <label
            className="form-label fw-semibold text-primary-light text-sm mb-8"
            htmlFor={`content-${section}`}
          >
            Content <span className="text-danger-600">*</span>
          </label>
          <div className="border border-neutral-200 radius-8 overflow-hidden mb-20">
            <div style={{ minHeight: "280px" }}>
              <ReactQuill
                key={`cms-${section}-${ownerScopeKey}`}
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                placeholder={`Enter ${meta.page_title.toLowerCase()}...`}
                readOnly={disabled}
                style={{ minHeight: "280px" }}
              />
            </div>
          </div>
          <div className="form-check form-switch mb-20">
            <input
              className="form-check-input"
              type="checkbox"
              id={`published-${section}`}
              checked={isPublished}
              onChange={(e) => setPublished(e.target.checked)}
              disabled={disabled}
            />
            <label
              className="form-check-label text-sm text-primary-light"
              htmlFor={`published-${section}`}
            >
              Publish this page
            </label>
          </div>
          <button
            type="button"
            className="btn btn-primary radius-8"
            onClick={() => saveSection(section)}
            disabled={disabled}
          >
            {saving ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="card h-100 p-0 radius-12">
        <div className="card-header border-bottom bg-base py-16 px-24">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h5 className="text-md text-primary-light mb-0">CMS — Legal pages</h5>
              <p className="text-xs text-secondary-light mb-0 mt-4">
                Edit Terms and Conditions and Privacy Policy. Each section has its own save button.
              </p>
            </div>
            {!isResellerRole && (
              <select
                className="form-select form-select-sm w-auto"
                style={{ minWidth: "220px" }}
                value={resellerFilter}
                onChange={(e) => setResellerFilter(e.target.value)}
                aria-label="Page owner"
              >
                <option value="admin">Admin (global)</option>
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    Reseller: {r.brand_name || r.business_name || r.email || r.id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="card-body p-24">
          {error && (
            <div className="alert alert-danger radius-8 mb-24" role="alert">
              <Icon
                icon="material-symbols:error-outline"
                className="icon me-2"
              />
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success radius-8 mb-24" role="alert">
              <Icon
                icon="material-symbols:check-circle-outline"
                className="icon me-2"
              />
              {success}
            </div>
          )}

          {loading ? (
            <div className="text-center py-40">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mt-3">Loading CMS pages...</p>
            </div>
          ) : (
            <>
              {renderLegalSection("terms")}
              {renderLegalSection("privacy")}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CmsLayer;
