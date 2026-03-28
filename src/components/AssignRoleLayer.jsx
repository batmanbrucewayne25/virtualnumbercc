import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { getMstSuperAdmins, updateMstSuperAdmin } from "@/hasura/mutations/admin";
import { getMstRoles } from "@/hasura/mutations/role";
import AlertModal from "./AlertModal";

const AssignRoleLayer = () => {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const menuButtonRef = useRef(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "", type: "info" });

  const MENU_MIN_WIDTH = 220;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [adminsResult, rolesResult] = await Promise.all([
        getMstSuperAdmins(),
        getMstRoles(),
      ]);

      if (adminsResult.success) {
        setAdmins(adminsResult.data || []);
      } else {
        setError(adminsResult.message || "Failed to load admins");
        console.error("Failed to load admins:", adminsResult);
      }

      if (rolesResult.success) {
        setRoles(rolesResult.data || []);
      } else {
        console.error("Failed to load roles:", rolesResult.message);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("An error occurred while loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (adminId, roleId) => {
    setOpenDropdownId(null);
    setUpdatingRoleId(adminId);
    try {
      // Update admin with role_id
      // Note: This assumes mst_super_admin has a role_id field
      // If not, you may need to add it to the table schema
      const result = await updateMstSuperAdmin(adminId, {
        role_id: roleId || null,
      });

      if (result.success) {
        // Refresh the list
        await fetchData();
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Role assigned successfully",
          type: "success"
        });
      } else {
        setAlertModal({
          isOpen: true,
          title: "Error",
          message: result.message || "Failed to assign role",
          type: "error"
        });
      }
    } catch (err) {
      console.error("Error assigning role:", err);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "An error occurred while assigning role",
        type: "error"
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Filter admins based on search and status (memoized — avoids unstable deps / re-init loops)
  const filteredAdmins = useMemo(
    () =>
      admins.filter((admin) => {
        const matchesSearch =
          searchTerm === "" ||
          `${admin.first_name} ${admin.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (admin.phone && admin.phone.includes(searchTerm));

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && admin.status) ||
          (statusFilter === "inactive" && !admin.status);

        return matchesSearch && matchesStatus;
      }),
    [admins, searchTerm, statusFilter]
  );

  // Close role dropdown when clicking outside (Bootstrap JS dropdown removed — was re-inited every render)
  useEffect(() => {
    const handleDocClick = (e) => {
      const el = e.target?.closest?.("[data-assign-role-dropdown]");
      if (!el) setOpenDropdownId(null);
    };
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, []);

  useEffect(() => {
    setOpenDropdownId(null);
  }, [searchTerm, statusFilter]);

  const toggleAssignMenu = useCallback((e, adminId) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenDropdownId((prev) => (prev === adminId ? null : adminId));
  }, []);

  // Fixed menu position so it is not clipped by .table-responsive overflow
  useLayoutEffect(() => {
    if (!openDropdownId) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const el = menuButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(MENU_MIN_WIDTH, rect.width);
      let left = rect.right - width;
      if (left < 8) left = 8;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      setMenuPos({
        top: rect.bottom + 4,
        left,
        width,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [openDropdownId]);

  const getRoleName = (roleId) => {
    if (!roleId) return "No Role";
    const role = roles.find((r) => r.id === roleId);
    return role ? role.role_name : "Unknown Role";
  };

  const getCurrentRoleId = (admin) => {
    // If role_id field exists, use it; otherwise return null
    return admin.role_id || null;
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <div className='d-flex align-items-center flex-wrap gap-3'>
          <form className='navbar-search'>
            <input
              type='text'
              className='bg-base h-40-px w-auto'
              name='search'
              placeholder='Search by name or email'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon icon='ion:search-outline' className='icon' />
          </form>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value='all'>All Status</option>
            <option value='active'>Active</option>
            <option value='inactive'>Inactive</option>
          </select>
        </div>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className='alert alert-danger radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
        )}

        {loading ? (
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading data...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='mdi:account-off' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>No admins found</p>
          </div>
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Username</th>
                    <th scope='col' className='text-center'>
                      Current Role
                    </th>
                    <th scope='col' className='text-center'>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin, index) => {
                    const currentRoleId = getCurrentRoleId(admin);
                    const isUpdating = updatingRoleId === admin.id;

                    return (
                      <tr key={admin.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className='d-flex align-items-center'>
                            <div className='w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden bg-primary-100 d-flex align-items-center justify-content-center'>
                              <Icon
                                icon='solar:user-bold'
                                className='icon text-primary-600 text-xl'
                              />
                            </div>
                            <div className='flex-grow-1'>
                              <span className='text-md mb-0 fw-normal text-secondary-light'>
                                {admin.first_name} {admin.last_name}
                              </span>
                              {admin.email && (
                                <p className='text-xs text-muted mb-0 mt-1'>
                                  {admin.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className='text-center'>
                          <span
                            className={`${
                              currentRoleId
                                ? "bg-primary-focus text-primary-600 border border-primary-main"
                                : "bg-neutral-200 text-neutral-600 border border-neutral-300"
                            } px-24 py-4 radius-4 fw-medium text-sm`}
                          >
                            {getRoleName(currentRoleId)}
                          </span>
                        </td>
                        <td className='text-center position-relative'>
                          <div
                            className='dropdown d-inline-block'
                            data-assign-role-dropdown
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              ref={openDropdownId === admin.id ? menuButtonRef : null}
                              className='btn btn-outline-primary-600 not-active px-18 py-11 dropdown-toggle toggle-icon'
                              type='button'
                              aria-expanded={openDropdownId === admin.id}
                              disabled={isUpdating || roles.length === 0}
                              onClick={(e) => toggleAssignMenu(e, admin.id)}
                            >
                              {isUpdating ? (
                                <>
                                  <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                  />
                                  Updating...
                                </>
                              ) : (
                                "Assign Role"
                              )}
                            </button>
                            <ul
                              className={`dropdown-menu dropdown-menu-end${openDropdownId === admin.id && menuPos ? " show" : ""}`}
                              style={
                                openDropdownId === admin.id && menuPos
                                  ? {
                                      position: "fixed",
                                      top: menuPos.top,
                                      left: menuPos.left,
                                      width: menuPos.width,
                                      zIndex: 1055,
                                      maxHeight: "min(320px, calc(100vh - 24px))",
                                      overflowY: "auto",
                                    }
                                  : undefined
                              }
                            >
                              <li>
                                <button
                                  type='button'
                                  className='dropdown-item px-16 py-8 rounded text-secondary-light bg-hover-neutral-200 text-hover-neutral-900 w-100 text-start border-0'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRoleChange(admin.id, null);
                                  }}
                                  disabled={isUpdating}
                                >
                                  No Role
                                </button>
                              </li>
                              {roles
                                .filter((role) => role.is_active !== false)
                                .map((role) => (
                                  <li key={role.id}>
                                    <button
                                      type='button'
                                      className={`dropdown-item px-16 py-8 rounded text-secondary-light bg-hover-neutral-200 text-hover-neutral-900 w-100 text-start border-0 ${
                                        currentRoleId === role.id ? "bg-primary-50" : ""
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRoleChange(admin.id, role.id);
                                      }}
                                      disabled={isUpdating}
                                    >
                                      {role.role_name}
                                      {currentRoleId === role.id && (
                                        <Icon
                                          icon='mdi:check'
                                          className='icon ms-2 text-primary-600'
                                        />
                                      )}
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24'>
              <span>
                Showing {filteredAdmins.length} of {admins.length} admin(s)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};

export default AssignRoleLayer;
