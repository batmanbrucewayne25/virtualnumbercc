import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstSuperAdmins, deleteMstSuperAdmin } from "@/hasura/mutations/admin";

const AdminListLayer = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstSuperAdmins();
      if (result.success) {
        setAdmins(result.data || []);
      } else {
        setError("Failed to load admins");
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
      setError("An error occurred while loading admins");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete admin "${name}"?`)) {
      return;
    }

    try {
      const result = await deleteMstSuperAdmin(id);
      if (result.success) {
        // Refresh the list
        fetchAdmins();
      } else {
        alert(result.message || "Failed to delete admin");
      }
    } catch (err) {
      console.error("Error deleting admin:", err);
      alert("An error occurred while deleting admin");
    }
  };

  // Filter admins based on search and status
  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch =
      searchTerm === "" ||
      `${admin.first_name} ${admin.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (admin.phone && admin.phone.includes(searchTerm));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && admin.status) ||
      (statusFilter === "inactive" && !admin.status);

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
              placeholder='Search by name, email, or phone'
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
        <Link
          to='/add-admin'
          className='btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
        >
          <Icon
            icon='ic:baseline-plus'
            className='icon text-xl line-height-1'
          />
          Add New Admin
        </Link>
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
            <p className='text-muted mt-3'>Loading admins...</p>
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
                    <th scope='col'>Date</th>
                    <th scope='col'>Name</th>
                    <th scope='col'>Email</th>
                    <th scope='col'>Phone</th>
                    <th scope='col' className='text-center'>
                      Status
                    </th>
                    <th scope='col' className='text-center'>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin, index) => (
                    <tr key={admin.id}>
                      <td>{index + 1}</td>
                      <td>{formatDate(admin.created_at)}</td>
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
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {admin.email}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {admin.phone || "-"}
                        </span>
                      </td>
                      <td className='text-center'>
                        <span
                          className={`${
                            admin.status
                              ? "bg-success-focus text-success-600 border border-success-main"
                              : "bg-danger-focus text-danger-600 border border-danger-main"
                          } px-24 py-4 radius-4 fw-medium text-sm`}
                        >
                          {admin.status ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className='text-center'>
                        <div className='d-flex align-items-center gap-10 justify-content-center'>
                          <Link
                            to={`/view-admin/${admin.id}`}
                            className='bg-info-focus bg-hover-info-200 text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                            title='View'
                          >
                            <Icon
                              icon='majesticons:eye-line'
                              className='icon text-xl'
                            />
                          </Link>
                          <Link
                            to={`/edit-admin/${admin.id}`}
                            className='bg-success-focus text-success-600 bg-hover-success-200 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                            title='Edit'
                          >
                            <Icon icon='lucide:edit' className='menu-icon' />
                          </Link>
                          <button
                            type='button'
                            onClick={() =>
                              handleDelete(
                                admin.id,
                                `${admin.first_name} ${admin.last_name}`
                              )
                            }
                            className='remove-item-btn bg-danger-focus bg-hover-danger-200 text-danger-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                            title='Delete'
                          >
                            <Icon
                              icon='fluent:delete-24-regular'
                              className='menu-icon'
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

export default AdminListLayer;
