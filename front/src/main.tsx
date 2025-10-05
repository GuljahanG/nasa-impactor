import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from "react-router";
import NeoIndex, { loader as neoIndexLoader } from "./pages/NeoIndex";
import NeoDetail, { loader as neoDetailLoader } from "./pages/NeoDetail";
import './index.css'
import App from './App.tsx'

const router = createBrowserRouter([
  { path: "/", element: <App /> }, // Home
  { path: "/neo", element: <NeoIndex />, loader: neoIndexLoader },  // Index
  { path: "/neo/:id", element: <NeoDetail />, loader: neoDetailLoader } // Detail
]);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <RouterProvider router={router} />
  </StrictMode>,
)
