import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import PasswordField from "@/components/Form/PasswordField";
import { login } from "@/utils/api";
import { saveAuthToken, isAuthenticated } from "@/utils/auth";
import { getUserWithPermissions } from "@/hasura/mutations/userPermissions";
import { getPublishedCmsPages, getCmsPageBySlug } from "@/hasura/mutations/cms";
import CmsPageModal from "@/components/CmsPageModal";

const SignInLayer = () => {
  const navigate = useNavigate();
  const buildType = import.meta.env.VITE_BUILD_TYPE || 'admin';
  const isClientHubBuild = buildType === 'clienthub';
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cmsPages, setCmsPages] = useState([]);
  const [cmsModalOpen, setCmsModalOpen] = useState(false);
  const [selectedCmsPage, setSelectedCmsPage] = useState(null);
  const [cmsPageLoading, setCmsPageLoading] = useState(false);

  // If already authenticated, redirect based on build type and role
  useEffect(() => {
    if (isAuthenticated()) {
      const buildType = import.meta.env.VITE_BUILD_TYPE || 'admin';
      const isClientHubBuild = buildType === 'clienthub';

      // Get user data from localStorage
      const userDataStr = localStorage.getItem('userData');
      if (userDataStr) {
        try {
          const user = JSON.parse(userDataStr);

          if (user.role === 'reseller') {
            // Reseller always goes to reseller dashboard
            navigate("/reseller-dashboard", { replace: true });
          } else if (user.role === 'admin' || user.role === 'super_admin') {
            // Admin goes to admin dashboard (root path in admin build)
            navigate("/", { replace: true });
          } else {
            // Default fallback
            navigate("/", { replace: true });
          }
        } catch (err) {
          console.error("Error parsing user data:", err);
          navigate("/", { replace: true });
        }
      } else {
        // No user data, default redirect
        navigate("/", { replace: true });
      }
    }
  }, [navigate]);

  // Fetch published CMS pages for footer
  useEffect(() => {
    const fetchCmsPages = async () => {
      try {
        const result = await getPublishedCmsPages();
        if (result.success && result.data) {
          setCmsPages(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch CMS pages:", err);
      }
    };
    fetchCmsPages();
  }, []);

  // Handle CMS page click
  const handleCmsPageClick = async (e, page) => {
    e.preventDefault();
    setCmsPageLoading(true);
    setCmsModalOpen(true);
    setSelectedCmsPage(null);

    try {
      const result = await getCmsPageBySlug(page.slug);
      if (result.success && result.data) {
        setSelectedCmsPage(result.data);
      } else {
        setError("Failed to load page content");
        setCmsModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to fetch CMS page:", err);
      setError("Failed to load page content");
      setCmsModalOpen(false);
    } finally {
      setCmsPageLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      // Call Node.js backend API for login
      const result = await login(email.trim(), password);

      console.log("Login result:", result);

      // Handle both response structures: { success, data: { token, user } } or { success, token, user }
      if (result.success) {
        // Check if signup completion is required (incomplete signup)
        if (result.requiresSignupCompletion) {
          console.log("⚠️  Signup incomplete, redirecting to signup page. Current step:", result.current_step);

          // Do NOT save token
          // Save email to localStorage so signup page can fetch user data
          localStorage.setItem("signupEmail", email.trim());

          // Calculate next step: current_step + 1
          const currentStep = result.current_step || 0;
          const nextStep = currentStep + 1;

          // Navigate to signup page with step parameter
          navigate(`/sign-up?step=${nextStep}`, { replace: true });
          return;
        }

        // Extract token and user from either structure
        const token = result.data?.token || result.token;
        const user = result.data?.user || result.user;

        if (!token || !user) {
          setError("Invalid response from server. Please try again.");
          return;
        }

        console.log("Saving auth token and user data:", { token: token ? "present" : "missing", user });

        // Save token first to ensure authentication is set
        saveAuthToken(token, user, null);

        // Fetch user permissions after login (non-blocking)
        let permissions = null;
        try {
          const permResult = await getUserWithPermissions(user.email || email.trim());
          if (permResult.success && permResult.data) {
            const roleData = permResult.data.mst_roles;
            if (roleData) {
              // Transform permissions into map: { permission_code: { can_view, can_create, can_update, can_delete } }
              const permMap = {};
              roleData.mst_role_permissions?.forEach((rp) => {
                if (rp.mst_permission?.permission_code) {
                  permMap[rp.mst_permission.permission_code] = {
                    can_view: rp.can_view || false,
                    can_create: rp.can_create || false,
                    can_update: rp.can_update || false,
                    can_delete: rp.can_delete || false,
                  };
                }
              });
              permissions = permMap;
              // Update permissions if fetched successfully
              if (Object.keys(permMap).length > 0) {
                localStorage.setItem('userPermissions', JSON.stringify(permMap));
              }
            }
          }
        } catch (permError) {
          console.error("Error fetching permissions:", permError);
          // Continue login even if permissions fail to load
        }

        // Dispatch event to refresh permissions in PermissionContext
        window.dispatchEvent(new Event('permissionsUpdated'));

        setError("");

        // Verify authentication is set
        const authCheck = isAuthenticated();
        console.log("Auth check after save:", authCheck);
        console.log("Token saved:", !!localStorage.getItem('authToken'));
        console.log("User data saved:", !!localStorage.getItem('userData'));

        // Determine redirect based on role and build type
        const buildType = import.meta.env.VITE_BUILD_TYPE || 'admin';
        const isClientHubBuild = buildType === 'clienthub';

        // Navigate based on user role
        console.log("User role:", user.role, user);
        console.log("Is ClientHub build:", isClientHubBuild);
        if (isClientHubBuild) {
          // Reseller always goes to reseller dashboard
          console.log("Navigating to reseller dashboard...");
          navigate("/reseller-dashboard", { replace: true });
        } else if (user.role === 'admin' || user.role === 'super_admin') {
          // Admin goes to admin dashboard (root path in admin build)
          if (isClientHubBuild) {
            // Admin shouldn't use ClientHub build, but handle gracefully
            console.log("Admin in ClientHub build - navigating to root...");
            navigate("/", { replace: true });
          } else {
            console.log("Navigating to admin dashboard...");
            navigate("/", { replace: true }); // Admin dashboard
          }
        } else {
          // Default fallback
          console.log("Navigating to root...");
          navigate("/", { replace: true });
        }
      } else {
        setError(result.message || "Invalid email or password.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className='auth bg-base d-flex flex-wrap'>
      <div className='auth-left d-lg-block d-none'>
        <div className='d-flex align-items-center flex-column h-100 justify-content-center'>
          <img src='assets/images/own/login.svg' alt='WowDash React Vite' />
        </div>
      </div>
      <div className='auth-right py-32 px-24 d-flex flex-column justify-content-center'>
        <div className='max-w-464-px mx-auto w-100'>
          <div>
            <Link to='/index' className='mb-40 max-w-290-px'>
              <img src='assets/images//own/dlogo.png' alt='WowDash React Vite' />
            </Link>
            <h4 className='mb-12'>Sign In to your Account</h4>
            <p className='mb-32 text-secondary-light text-lg'>
              Welcome back! please enter your details
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className='icon-field mb-16'>
              <span className='icon top-50 translate-middle-y'>
                <Icon icon='mage:email' />
              </span>
              <input
                type='email'
                className='form-control h-56-px bg-neutral-50 radius-12'
                placeholder='Email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className='position-relative mb-20'>
              <div className='icon-field'>
                <span className='icon top-50 translate-middle-y'>
                  <Icon icon='solar:lock-password-outline' />
                </span>
                <PasswordField
                  id='your-password'
                  placeholder='Password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='bg-neutral-50 radius-12'
                  required
                />
              </div>
            </div>
            <div className=''>
              <div className='d-flex justify-content-between gap-2'>
                <div className='form-check style-check d-flex align-items-center'>
                  <input
                    className='form-check-input border border-neutral-300'
                    type='checkbox'
                    defaultValue=''
                    id='remeber'
                  />
                  <label className='form-check-label' htmlFor='remeber'>
                    Remember me{" "}
                  </label>
                </div>
                <Link to='/forgot-password' className='text-primary-600 fw-medium'>
                  Forgot Password?
                </Link>
              </div>
            </div>
            <button
              type='submit'
              className='btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-32'
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {error && (
              <div className='mt-16 text-danger'>{error}</div>
            )}

            {/* <div className='mt-32 d-flex align-items-center gap-3'>
              <button
                type='button'
                className='fw-semibold text-primary-light py-16 px-24 w-50 border radius-12 text-md d-flex align-items-center justify-content-center gap-12 line-height-1 bg-hover-primary-50'
              >
                <Icon
                  icon='ic:baseline-facebook'
                  className='text-primary-600 text-xl line-height-1'
                />
                Google
              </button>
              <button
                type='button'
                className='fw-semibold text-primary-light py-16 px-24 w-50 border radius-12 text-md d-flex align-items-center justify-content-center gap-12 line-height-1 bg-hover-primary-50'
              >
                <Icon
                  icon='logos:google-icon'
                  className='text-primary-600 text-xl line-height-1'
                />
                Google
              </button>
            </div> */}
            {!isClientHubBuild && (
              <>
                <div className='mt-32 center-border-horizontal text-center'>
                  <span className='bg-base z-1 px-4'>Or sign in with</span>
                </div>

                <div className='mt-32 text-center text-sm'>
                  <p className='mb-0'>
                    Don't have an account?{" "}
                    <Link to='/sign-up' className='text-primary-600 fw-semibold'>
                      Sign Up
                    </Link>
                  </p>
                </div>
              </>
            )}

            {/* CMS Pages Links */}
            {cmsPages.length > 0 && (
              <div className='mt-24 text-center'>
                <div className='d-flex flex-wrap justify-content-center gap-3'>
                  {cmsPages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={(e) => handleCmsPageClick(e, page)}
                      className='btn btn-link text-sm text-secondary-light text-decoration-none p-0'
                    >
                      {page.page_title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* CMS Page Modal */}
      <CmsPageModal
        isOpen={cmsModalOpen}
        onClose={() => {
          setCmsModalOpen(false);
          setSelectedCmsPage(null);
        }}
        page={selectedCmsPage}
        loading={cmsPageLoading}
      />
    </section>
  );
};

export default SignInLayer;
