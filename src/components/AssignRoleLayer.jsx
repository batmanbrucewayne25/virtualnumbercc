import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstSuperAdmins, updateMstSuperAdmin } from "@/hasura/mutations/admin";
import { getMstRoles } from "@/hasura/mutations/role";

const AssignRoleLayer = () => {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

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
        alert("Role assigned successfully");
      } else {
        alert(result.message || "Failed to assign role");
      }
    } catch (err) {
      console.error("Error assigning role:", err);
      alert("An error occurred while assigning role");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Filter admins based on search and status
  const filteredAdmins = admins.filter((admin) => {
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
  });

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
                        <td className='text-center'>
                          <div className='dropdown'>
                            <button
                              className='btn btn-outline-primary-600 not-active px-18 py-11 dropdown-toggle toggle-icon'
                              type='button'
                              data-bs-toggle='dropdown'
                              aria-expanded='false'
                              disabled={isUpdating || roles.length === 0}
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
                            <ul className='dropdown-menu'>
                              <li>
                                <button
                                  className='dropdown-item px-16 py-8 rounded text-secondary-light bg-hover-neutral-200 text-hover-neutral-900 w-100 text-start border-0'
                                  onClick={() => handleRoleChange(admin.id, null)}
                                  disabled={isUpdating}
                                >
                                  No Role
                                </button>
                              </li>
                              {roles
                                .filter((role) => role.is_active)
                                .map((role) => (
                                  <li key={role.id}>
                                    <button
                                      className={`dropdown-item px-16 py-8 rounded text-secondary-light bg-hover-neutral-200 text-hover-neutral-900 w-100 text-start border-0 ${
                                        currentRoleId === role.id ? "bg-primary-50" : ""
                                      }`}
                                      onClick={() => handleRoleChange(admin.id, role.id)}
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
    </div>
  );
};

export default AssignRoleLayer;
