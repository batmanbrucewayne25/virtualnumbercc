import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect, useRef } from "react";
import {
  getMstRoles,
  createMstRole,
  updateMstRole,
  deleteMstRole,
  getMstRolePermissions,
  upsertMstRolePermission,
} from "@/hasura/mutations/role";
import { getMstPermissions } from "@/hasura/mutations/permission";

const RoleAccessLayer = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    role_name: "",
    role_type: "",
    description: "",
    is_active: true,
  });
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({}); // { permission_id: { can_view, can_create, can_update, can_delete } }
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const modalRef = useRef(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    // Handle modal backdrop and body scroll
    if (showModal) {
      document.body.classList.add('modal-open');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.id = 'roleModalBackdrop';
      document.body.appendChild(backdrop);
      
      return () => {
        document.body.classList.remove('modal-open');
        const backdropEl = document.getElementById('roleModalBackdrop');
        if (backdropEl) {
          backdropEl.remove();
        }
      };
    } else {
      document.body.classList.remove('modal-open');
      const backdropEl = document.getElementById('roleModalBackdrop');
      if (backdropEl) {
        backdropEl.remove();
      }
    }
  }, [showModal]);

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const fetchRoles = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstRoles();
      if (result.success) {
        setRoles(result.data || []);
      } else {
        setError(result.message || "Failed to load roles");
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
      setError("An error occurred while loading roles");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role_name: "",
      role_type: "",
      description: "",
      is_active: true,
    });
    setRolePermissions({});
    setEditingRole(null);
  };

  const fetchPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const result = await getMstPermissions();
      if (result.success) {
        setPermissions(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const fetchRolePermissions = async (roleId) => {
    try {
      const result = await getMstRolePermissions(roleId);
      if (result.success && result.data) {
        const permissionsMap = {};
        result.data.forEach((rp) => {
          permissionsMap[rp.permission_id] = {
            id: rp.id,
            can_view: rp.can_view || false,
            can_create: rp.can_create || false,
            can_update: rp.can_update || false,
            can_delete: rp.can_delete || false,
          };
        });
        setRolePermissions(permissionsMap);
      }
    } catch (err) {
      console.error("Error fetching role permissions:", err);
    }
  };

  const handleEdit = async (role) => {
    setEditingRole(role);
    setFormData({
      role_name: role.role_name || "",
      role_type: role.role_type || "",
      description: role.description || "",
      is_active: role.is_active !== undefined ? role.is_active : true,
    });
    // Load existing permissions for this role
    await fetchRolePermissions(role.id);
    setShowModal(true);
  };

  const handleAddRole = () => {
    resetForm();
    setShowModal(true);
  };

  useEffect(() => {
    if (showModal) {
      fetchPermissions();
    }
  }, [showModal]);

  const handlePermissionChange = (permissionId, permissionType, checked) => {
    setRolePermissions((prev) => ({
      ...prev,
      [permissionId]: {
        can_view: prev[permissionId]?.can_view || false,
        can_create: prev[permissionId]?.can_create || false,
        can_update: prev[permissionId]?.can_update || false,
        can_delete: prev[permissionId]?.can_delete || false,
        [permissionType]: checked,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.role_name.trim()) {
      alert("Role name is required");
      return;
    }

    if (!formData.role_type.trim()) {
      alert("Role type is required");
      return;
    }

    try {
      let roleResult;
      let roleId;

      // Create or update role
      if (editingRole) {
        roleResult = await updateMstRole(editingRole.id, formData);
        roleId = editingRole.id;
      } else {
        roleResult = await createMstRole(formData);
        roleId = roleResult.data?.id;
      }

      if (!roleResult.success || !roleId) {
        alert(roleResult.message || "Failed to save role");
        return;
      }

      // Save role permissions
      const permissionPromises = Object.entries(rolePermissions).map(
        ([permissionId, perms]) => {
          // Only save if at least one permission is checked
          if (perms.can_view || perms.can_create || perms.can_update || perms.can_delete) {
            return upsertMstRolePermission({
              role_id: roleId,
              permission_id: permissionId,
              can_view: perms.can_view || false,
              can_create: perms.can_create || false,
              can_update: perms.can_update || false,
              can_delete: perms.can_delete || false,
            });
          }
          return Promise.resolve({ success: true });
        }
      );

      await Promise.all(permissionPromises);

      // Close modal by setting state
      setShowModal(false);
      // Refresh list
      fetchRoles();
      resetForm();
    } catch (err) {
      console.error("Error saving role:", err);
      alert("An error occurred while saving role");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete role "${name}"?`)) {
      return;
    }

    try {
      const result = await deleteMstRole(id);
      if (result.success) {
        fetchRoles();
      } else {
        alert(result.message || "Failed to delete role");
      }
    } catch (err) {
      console.error("Error deleting role:", err);
      alert("An error occurred while deleting role");
    }
  };

  // Filter roles based on search and status
  const filteredRoles = roles.filter((role) => {
    const matchesSearch =
      searchTerm === "" ||
      role.role_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.role_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && role.is_active) ||
      (statusFilter === "inactive" && !role.is_active);

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      <div className="card h-100 p-0 radius-12">
        <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
          <div className="d-flex align-items-center flex-wrap gap-3">
            <form className="navbar-search">
              <input
                type="text"
                className="bg-base h-40-px w-auto"
                name="search"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Icon icon="ion:search-outline" className="icon" />
            </form>
            <select
              className="form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2"
            onClick={handleAddRole}
          >
            <Icon icon="ic:baseline-plus" className="icon text-xl line-height-1" />
            Add New Role
          </button>
        </div>
        <div className="card-body p-24">
          {error && (
            <div className="alert alert-danger radius-8 mb-24" role="alert">
              <Icon icon="material-symbols:error-outline" className="icon me-2" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-40">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mt-3">Loading roles...</p>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-center py-40">
              <Icon icon="mdi:shield-off" className="icon text-6xl text-muted mb-3" />
              <p className="text-muted">No roles found</p>
            </div>
          ) : (
            <>
              <div className="table-responsive scroll-sm">
                <table className="table bordered-table sm-table mb-0">
                  <thead>
                    <tr>
                      <th scope="col">S.L</th>
                      <th scope="col">Create Date</th>
                      <th scope="col">Role Name</th>
                      <th scope="col">Role Type</th>
                      <th scope="col">Description</th>
                      <th scope="col" className="text-center">
                        Status
                      </th>
                      <th scope="col" className="text-center">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoles.map((role, index) => (
                      <tr key={role.id}>
                        <td>{index + 1}</td>
                        <td>{formatDate(role.created_at)}</td>
                        <td>
                          <span className="text-md mb-0 fw-medium text-secondary-light">
                            {role.role_name}
                          </span>
                        </td>
                        <td>
                          <span className="text-md mb-0 fw-normal text-secondary-light">
                            {role.role_type}
                          </span>
                        </td>
                        <td>
                          <p className="max-w-500-px mb-0 text-secondary-light text-sm">
                            {role.description || "-"}
                          </p>
                        </td>
                        <td className="text-center">
                          <span
                            className={`${
                              role.is_active
                                ? "bg-success-focus text-success-600 border border-success-main"
                                : "bg-danger-focus text-danger-600 border border-danger-main"
                            } px-24 py-4 radius-4 fw-medium text-sm`}
                          >
                            {role.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="d-flex align-items-center gap-10 justify-content-center">
                            <button
                              type="button"
                              onClick={() => handleEdit(role)}
                              className="bg-success-focus text-success-600 bg-hover-success-200 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle"
                              title="Edit"
                            >
                              <Icon icon="lucide:edit" className="menu-icon" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(role.id, role.role_name)}
                              className="remove-item-btn bg-danger-focus bg-hover-danger-200 text-danger-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle"
                              title="Delete"
                            >
                              <Icon
                                icon="fluent:delete-24-regular"
                                className="menu-icon"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24">
                <span>
                  Showing {filteredRoles.length} of {roles.length} role(s)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Start */}
      {showModal && (
        <div
          className={`modal fade ${showModal ? 'show' : ''}`}
          id="roleModal"
          ref={modalRef}
          tabIndex={-1}
          aria-labelledby="roleModalLabel"
          aria-hidden={!showModal}
          style={{ display: showModal ? 'block' : 'none' }}
        >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content radius-16 bg-base">
            <div className="modal-header py-16 px-24 border border-top-0 border-start-0 border-end-0">
              <h1 className="modal-title fs-5" id="roleModalLabel">
                {editingRole ? "Edit Role" : "Add New Role"}
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={handleCloseModal}
              />
            </div>
            <div className="modal-body p-24">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-12 mb-20">
                    <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                      Role Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control radius-8"
                      placeholder="Enter Role Name"
                      value={formData.role_name}
                      onChange={(e) =>
                        setFormData({ ...formData, role_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="col-12 mb-20">
                    <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                      Role Type <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control radius-8"
                      placeholder="Enter Role Type (e.g., admin, manager, user)"
                      value={formData.role_type}
                      onChange={(e) =>
                        setFormData({ ...formData, role_type: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="col-12 mb-20">
                    <label
                      htmlFor="desc"
                      className="form-label fw-semibold text-primary-light text-sm mb-8"
                    >
                      Description
                    </label>
                    <textarea
                      className="form-control radius-8"
                      id="desc"
                      rows={4}
                      placeholder="Write role description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-12 mb-20">
                    <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                      Status <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex align-items-center flex-wrap gap-28">
                      <div className="form-check checked-success d-flex align-items-center gap-2">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="status"
                          id="statusActive"
                          checked={formData.is_active === true}
                          onChange={() => setFormData({ ...formData, is_active: true })}
                        />
                        <label
                          className="form-check-label line-height-1 fw-medium text-secondary-light text-sm d-flex align-items-center gap-1"
                          htmlFor="statusActive"
                        >
                          <span className="w-8-px h-8-px bg-success-600 rounded-circle" />
                          Active
                        </label>
                      </div>
                      <div className="form-check checked-danger d-flex align-items-center gap-2">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="status"
                          id="statusInactive"
                          checked={formData.is_active === false}
                          onChange={() => setFormData({ ...formData, is_active: false })}
                        />
                        <label
                          className="form-check-label line-height-1 fw-medium text-secondary-light text-sm d-flex align-items-center gap-1"
                          htmlFor="statusInactive"
                        >
                          <span className="w-8-px h-8-px bg-danger-600 rounded-circle" />
                          Inactive
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Permissions Section */}
                  <div className="col-12 mb-20">
                    <label className="form-label fw-semibold text-primary-light text-sm mb-16">
                      Permissions
                    </label>
                    {loadingPermissions ? (
                      <div className="text-center py-20">
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    ) : permissions.length === 0 ? (
                      <p className="text-muted text-sm">No permissions available. Please seed permissions first.</p>
                    ) : (
                      <div className="border radius-8 p-16" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {(() => {
                          // Group permissions by module
                          const groupedPermissions = permissions.reduce((acc, permission) => {
                            const module = permission.module || 'Other';
                            if (!acc[module]) {
                              acc[module] = [];
                            }
                            acc[module].push(permission);
                            return acc;
                          }, {});

                          // Define module order
                          const moduleOrder = ['Dashboard', 'Admin', 'Reseller', 'Wallet', 'Roles', 'Settings'];
                          const sortedModules = Object.keys(groupedPermissions).sort((a, b) => {
                            const indexA = moduleOrder.indexOf(a);
                            const indexB = moduleOrder.indexOf(b);
                            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                            if (indexA === -1) return 1;
                            if (indexB === -1) return -1;
                            return indexA - indexB;
                          });

                          return sortedModules.map((module) => (
                            <div key={module} className="mb-24">
                              <h6 className="text-primary-light fw-semibold text-sm mb-12 pb-8 border-bottom border-secondary-200">
                                {module}
                              </h6>
                              <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                  <thead>
                                    <tr>
                                      <th className="text-xs fw-semibold text-secondary-light">Permission</th>
                                      <th className="text-center text-xs fw-semibold text-secondary-light">View</th>
                                      <th className="text-center text-xs fw-semibold text-secondary-light">Create</th>
                                      <th className="text-center text-xs fw-semibold text-secondary-light">Update</th>
                                      <th className="text-center text-xs fw-semibold text-secondary-light">Delete</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groupedPermissions[module].map((permission) => {
                                      const permData = rolePermissions[permission.id] || {
                                        can_view: false,
                                        can_create: false,
                                        can_update: false,
                                        can_delete: false,
                                      };
                                      return (
                                        <tr key={permission.id}>
                                          <td>
                                            <span className="text-xs fw-medium text-secondary-light">
                                              {permission.permission_name}
                                            </span>
                                          </td>
                                          <td className="text-center">
                                            <input
                                              type="checkbox"
                                              className="form-check-input"
                                              checked={permData.can_view || false}
                                              onChange={(e) =>
                                                handlePermissionChange(permission.id, 'can_view', e.target.checked)
                                              }
                                            />
                                          </td>
                                          <td className="text-center">
                                            <input
                                              type="checkbox"
                                              className="form-check-input"
                                              checked={permData.can_create || false}
                                              onChange={(e) =>
                                                handlePermissionChange(permission.id, 'can_create', e.target.checked)
                                              }
                                            />
                                          </td>
                                          <td className="text-center">
                                            <input
                                              type="checkbox"
                                              className="form-check-input"
                                              checked={permData.can_update || false}
                                              onChange={(e) =>
                                                handlePermissionChange(permission.id, 'can_update', e.target.checked)
                                              }
                                            />
                                          </td>
                                          <td className="text-center">
                                            <input
                                              type="checkbox"
                                              className="form-check-input"
                                              checked={permData.can_delete || false}
                                              onChange={(e) =>
                                                handlePermissionChange(permission.id, 'can_delete', e.target.checked)
                                              }
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="d-flex align-items-center justify-content-center gap-3 mt-24">
                    <button
                      type="button"
                      className="border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-40 py-11 radius-8"
                      onClick={handleCloseModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary border border-primary-600 text-md px-48 py-12 radius-8"
                    >
                      {editingRole ? "Update" : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      )}
      {/* Modal End */}
    </>
  );
};

export default RoleAccessLayer;
