import { graphqlRequest } from "@/hasura";

/**
 * Get all CMS pages
 */
export const getCmsPages = async () => {
  const QUERY = `query GetCmsPages {
    cms_pages(
      order_by: { created_date: desc }
    ) {
      id
      page_title
      content
      created_date
      updated_date
      is_published
      slug
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch CMS pages",
        data: [],
      };
    }
    if (result?.data?.cms_pages) {
      return {
        success: true,
        data: result.data.cms_pages,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch CMS pages",
      data: [],
    };
  }
};

/**
 * Get published CMS pages only
 */
export const getPublishedCmsPages = async () => {
  const QUERY = `query GetPublishedCmsPages {
    cms_pages(
      where: { is_published: { _eq: true } }
      order_by: { created_date: desc }
    ) {
      id
      page_title
      content
      created_date
      updated_date
      is_published
      slug
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch published CMS pages",
        data: [],
      };
    }
    if (result?.data?.cms_pages) {
      return {
        success: true,
        data: result.data.cms_pages,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch published CMS pages",
      data: [],
    };
  }
};

/**
 * Get CMS page by slug
 */
export const getCmsPageBySlug = async (slug: string) => {
  if (!slug || typeof slug !== 'string') {
    return {
      success: false,
      message: "Invalid slug",
      data: null,
    };
  }

  const QUERY = `query GetCmsPageBySlug($slug: String!) {
    cms_pages(
      where: { slug: { _eq: $slug }, is_published: { _eq: true } }
      limit: 1
    ) {
      id
      page_title
      content
      created_date
      updated_date
      is_published
      slug
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { slug });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch CMS page",
        data: null,
      };
    }
    if (result?.data?.cms_pages && result.data.cms_pages.length > 0) {
      return {
        success: true,
        data: result.data.cms_pages[0],
      };
    }
    return {
      success: false,
      message: "CMS page not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch CMS page",
      data: null,
    };
  }
};

/**
 * Get CMS page by ID
 */
export const getCmsPageById = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid CMS page ID format",
      data: null,
    };
  }

  const QUERY = `query GetCmsPageById($id: uuid!) {
    cms_page_by_pk(id: $id) {
      id
      page_title
      content
      created_date
      updated_date
      is_published
      slug
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch CMS page",
        data: null,
      };
    }
    if (result?.data?.cms_page_by_pk) {
      return {
        success: true,
        data: result.data.cms_page_by_pk,
      };
    }
    return {
      success: false,
      message: "CMS page not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch CMS page",
      data: null,
    };
  }
};

/**
 * Create CMS page
 */
export const createCmsPage = async (data: {
  page_title: string;
  content: string;
  slug: string;
  is_published?: boolean;
}) => {
  const MUTATION = `mutation CreateCmsPage(
    $page_title: String!
    $content: String!
    $slug: String!
    $is_published: Boolean
  ) {
    insert_cms_pages_one(object: {
      page_title: $page_title
      content: $content
      slug: $slug
      is_published: $is_published
    }) {
      id
      page_title
      content
      slug
      is_published
      created_date
      updated_date
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      page_title: data.page_title,
      content: data.content,
      slug: data.slug,
      is_published: data.is_published || false,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create CMS page",
        data: null,
      };
    }

    if (result?.data?.insert_cms_pages_one) {
      return {
        success: true,
        data: result.data.insert_cms_pages_one,
        message: "CMS page created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create CMS page",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create CMS page",
      data: null,
    };
  }
};

/**
 * Update CMS page
 */
export const updateCmsPage = async (
  id: string,
  data: {
    page_title?: string;
    content?: string;
    slug?: string;
    is_published?: boolean;
  }
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid CMS page ID format",
      data: null,
    };
  }

  const MUTATION = `mutation UpdateCmsPage(
    $id: uuid!
    $page_title: String
    $content: String
    $slug: String
    $is_published: Boolean
    $updated_date: timestamptz
  ) {
    update_cms_pages_by_pk(
      pk_columns: { id: $id }
      _set: {
        page_title: $page_title
        content: $content
        slug: $slug
        is_published: $is_published
        updated_date: $updated_date
      }
    ) {
      id
      page_title
      content
      slug
      is_published
      created_date
      updated_date
    }
  }`;

  try {
    const updateData: any = {};
    if (data.page_title !== undefined) updateData.page_title = data.page_title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.is_published !== undefined) updateData.is_published = data.is_published;

    const result = await graphqlRequest(MUTATION, {
      id,
      ...updateData,
      updated_date: new Date().toISOString(),
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update CMS page",
        data: null,
      };
    }

    if (result?.data?.update_cms_pages_by_pk) {
      return {
        success: true,
        data: result.data.update_cms_pages_by_pk,
        message: "CMS page updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update CMS page",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update CMS page",
      data: null,
    };
  }
};

/**
 * Delete CMS page
 */
export const deleteCmsPage = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid CMS page ID format",
    };
  }

  const MUTATION = `mutation DeleteCmsPage($id: uuid!) {
    delete_cms_page_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete CMS page",
      };
    }
    if (result?.data?.delete_cms_page_by_pk) {
      return {
        success: true,
        message: "CMS page deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete CMS page",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to delete CMS page",
    };
  }
};

