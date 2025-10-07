import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  // IMPORTANT: Replace this with your actual production domain
  const baseUrl = 'https://tradewatch10.vercel.app';

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/watchlist`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/orders`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/portfolio`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/profile`,
      lastModified: new Date(),
    },
     {
      url: `${baseUrl}/funds`,
      lastModified: new Date(),
    },
     {
      url: `${baseUrl}/invite`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/manual`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/settings`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/support`,
      lastModified: new Date(),
    },
     {
      url: `${baseUrl}/community`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/profile-details`,
      lastModified: new Date(),
    },
  ]
}
