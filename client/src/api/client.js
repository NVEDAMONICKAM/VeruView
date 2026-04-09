import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// Trees
export const getTrees = () => api.get('/trees');
export const createTree = (data) => api.post('/trees', data);
export const getTree = (id) => api.get(`/trees/${id}`);
export const updateTree = (id, data) => api.put(`/trees/${id}`, data);
export const deleteTree = (id) => api.delete(`/trees/${id}`);
export const shareTree = (id) => api.post(`/trees/${id}/share`);
export const getKinship = (treeId, perspectiveId) =>
  api.get(`/trees/${treeId}/kinship/${perspectiveId}`);
export const upsertTitleOverride = (treeId, data) =>
  api.put(`/trees/${treeId}/title-overrides`, data);

// People
export const getPeople = (treeId) => api.get(`/trees/${treeId}/people`);
export const createPerson = (treeId, formData) =>
  api.post(`/trees/${treeId}/people`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updatePerson = (treeId, personId, formData) =>
  api.put(`/trees/${treeId}/people/${personId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const deletePerson = (treeId, personId) =>
  api.delete(`/trees/${treeId}/people/${personId}`);

// Relationships
export const getRelationships = (treeId) => api.get(`/trees/${treeId}/relationships`);
export const createRelationship = (treeId, data) =>
  api.post(`/trees/${treeId}/relationships`, data);
export const updateRelationship = (treeId, relId, data) =>
  api.put(`/trees/${treeId}/relationships/${relId}`, data);
export const deleteRelationship = (treeId, relId) =>
  api.delete(`/trees/${treeId}/relationships/${relId}`);

// Node positions
export const patchNodePositions = (treeId, positions) =>
  api.patch(`/trees/${treeId}/node-positions`, { positions });

// Shared (public) tree
export const getSharedTree = (token) => api.get(`/share/${token}`);
export const getSharedKinship = (token, perspectiveId) =>
  api.get(`/share/${token}/kinship/${perspectiveId}`);

export default api;
