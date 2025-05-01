import React, { useState } from 'react';
import Image from 'next/image';
import { Attendee } from '@/types';
import { apolloService, ApolloContact, ApolloEnrichmentResponse } from '@/lib/apollo';
import { ArrowPathIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface ApolloIntegrationProps {
  selectedAttendees: Attendee[];
  conferenceName: string;
  onEnrichmentComplete: (enrichedData: ApolloEnrichmentResponse[]) => void;
}

export default function ApolloIntegration({ 
  selectedAttendees,
  conferenceName,
  onEnrichmentComplete 
}: ApolloIntegrationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichedData, setEnrichedData] = useState<ApolloEnrichmentResponse[]>([]);

  const handleEnrich = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert attendees to search params
      const searchParams = selectedAttendees.map(attendee => ({
        firstName: attendee.first_name,
        lastName: attendee.last_name,
        organization: attendee.health_systems?.name || attendee.company || ''
      }));

      const enriched = await apolloService.enrichContacts(searchParams);
      setEnrichedData(enriched);
      onEnrichmentComplete(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushToApollo = async () => {
    if (!conferenceName) {
      setError('Conference name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Convert attendees to Apollo contacts
      const contacts: ApolloContact[] = selectedAttendees.map(attendee => ({
        id: attendee.id.toString(),
        firstName: attendee.first_name,
        lastName: attendee.last_name,
        name: `${attendee.first_name} ${attendee.last_name}`,
        email: '', // We don't have email
        title: '', // We don't have title
        organization: attendee.health_systems?.name || attendee.company || '',
        phone: '', // We don't have phone
        linkedinUrl: '', // We don't have LinkedIn URL
      }));

      await apolloService.pushContactsToApollo(contacts, conferenceName);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push contacts to Apollo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Image 
            src="/apollo.svg" 
            alt="Apollo Logo" 
            width={32} 
            height={32} 
            className="h-8 w-8"
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Apollo Integration</h3>
            <p className="text-sm text-gray-500">Enrich and sync contact data with Apollo</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleEnrich}
          disabled={isLoading || selectedAttendees.length === 0}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
              Enriching...
            </>
          ) : (
            <>
              <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" />
              Enrich Contact Data
            </>
          )}
        </button>

        <button
          onClick={handlePushToApollo}
          disabled={isLoading || selectedAttendees.length === 0 || !conferenceName}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
              Pushing...
            </>
          ) : (
            <>
              <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />
              Push to Apollo
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {enrichedData.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Enriched Data</h4>
          <div className="space-y-4">
            {enrichedData.map((data, index) => (
              <div key={index} className="bg-white overflow-hidden shadow-lg border border-gray-100 rounded-xl">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
                  <div className="flex items-center">
                    {data.person.photo_url ? (
                      <Image 
                        src={data.person.photo_url} 
                        alt={`${data.person.firstName} ${data.person.lastName}`}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-full ring-2 ring-white shadow-sm mr-4 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-medium mr-4 ring-2 ring-white shadow-sm">
                        {data.person.firstName[0]}{data.person.lastName[0]}
                      </div>
                    )}
                    <div>
                      <h5 className="text-xl font-semibold text-gray-900">
                        {data.person.firstName} {data.person.lastName}
                      </h5>
                      {data.person.headline && (
                        <p className="mt-1 text-sm text-gray-600">{data.person.headline}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-6">
                  <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="col-span-1 space-y-6">
                      {data.person.email && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500 flex items-center">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </dt>
                          <dd className="mt-2 text-sm text-gray-900 flex items-center">
                            {data.person.email}
                            {data.person.email_status && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {data.person.email_status}
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                      {data.person.phone && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500 flex items-center">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Phone
                          </dt>
                          <dd className="mt-2 text-sm text-gray-900">{data.person.phone}</dd>
                        </div>
                      )}
                      <div className="rounded-lg bg-gray-50 p-4">
                        <dt className="text-sm font-medium text-gray-500">Social Profiles</dt>
                        <dd className="mt-2">
                          <div className="space-y-2">
                            {data.person.linkedinUrl && (
                              <a href={data.person.linkedinUrl} target="_blank" rel="noopener noreferrer" 
                                 className="flex items-center text-sm text-blue-600 hover:text-blue-500">
                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                                LinkedIn Profile
                              </a>
                            )}
                            {data.person.twitter_url && (
                              <a href={data.person.twitter_url} target="_blank" rel="noopener noreferrer" 
                                 className="flex items-center text-sm text-blue-400 hover:text-blue-500">
                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                                </svg>
                                Twitter Profile
                              </a>
                            )}
                          </div>
                        </dd>
                      </div>
                    </div>
                    <div className="col-span-1 space-y-6">
                      {(data.person.city || data.person.state || data.person.country) && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500 flex items-center">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Location
                          </dt>
                          <dd className="mt-2 text-sm text-gray-900">
                            {[data.person.city, data.person.state, data.person.country].filter(Boolean).join(', ')}
                          </dd>
                        </div>
                      )}
                      {((data.person.departments && data.person.departments.length > 0) || 
                        (data.person.subdepartments && data.person.subdepartments.length > 0) || 
                        (data.person.functions && data.person.functions.length > 0) || 
                        data.person.seniority) && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500">Role Information</dt>
                          <dd className="mt-2 space-y-2">
                            {data.person.seniority && (
                              <div className="flex items-center">
                                <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                                  {data.person.seniority}
                                </span>
                              </div>
                            )}
                            {data.person.departments && data.person.departments.length > 0 && (
                              <div className="text-sm text-gray-900">
                                <span className="font-medium">Departments:</span>{' '}
                                {data.person.departments.map((dept, i) => (
                                  <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-1">
                                    {dept}
                                  </span>
                                ))}
                              </div>
                            )}
                          </dd>
                        </div>
                      )}
                    </div>
                    {data.person.employment_history && data.person.employment_history.length > 0 && (
                      <div className="sm:col-span-2 rounded-lg bg-gray-50 p-4">
                        <dt className="text-sm font-medium text-gray-500 mb-6 flex items-center">
                          <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Employment History
                        </dt>
                        <dd>
                          <ul className="-mb-8">
                            {data.person.employment_history.map((job, index, array) => (
                              <li key={index}>
                                <div className="relative pb-12">
                                  {index !== array.length - 1 && (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                  )}
                                  <div className="relative flex space-x-3">
                                    <div>
                                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${job.current ? 'bg-green-500' : 'bg-gray-400'}`}>
                                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                      </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-gray-900">{job.title}</div>
                                      <p className="mt-1 text-sm text-gray-500">{job.organization_name}</p>
                                      <p className="mt-1 text-xs text-gray-400">
                                        {job.start_date && new Date(job.start_date).getFullYear()}
                                        {job.end_date ? ` - ${new Date(job.end_date).getFullYear()}` : ' - Present'}
                                        {job.current && <span className="ml-2 text-green-600">(Current)</span>}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {data.organization && (
                      <div className="sm:col-span-2 rounded-lg bg-gray-50 p-4">
                        <dt className="text-sm font-medium text-gray-500 mb-4 flex items-center">
                          <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Organization Details
                        </dt>
                        <dd>
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">{data.organization.name}</h4>
                              <div className="mt-2 flex space-x-3">
                                {data.organization.website_url && (
                                  <a href={data.organization.website_url} target="_blank" rel="noopener noreferrer" 
                                     className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 border border-gray-200">
                                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    Website
                                  </a>
                                )}
                                {data.organization.linkedin_url && (
                                  <a href={data.organization.linkedin_url} target="_blank" rel="noopener noreferrer" 
                                     className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-white text-blue-600 hover:bg-blue-50 border border-gray-200">
                                    <svg className="h-4 w-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                    </svg>
                                    LinkedIn
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {data.organization.industry && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Industry</span>
                                  <p className="mt-1 text-sm text-gray-900">{data.organization.industry}</p>
                                </div>
                              )}
                              {data.organization.estimated_num_employees > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Employees</span>
                                  <p className="mt-1 text-sm text-gray-900">{data.organization.estimated_num_employees.toLocaleString()}</p>
                                </div>
                              )}
                              {data.organization.founded_year && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Founded</span>
                                  <p className="mt-1 text-sm text-gray-900">{data.organization.founded_year}</p>
                                </div>
                              )}
                              {data.organization.annual_revenue > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Annual Revenue</span>
                                  <p className="mt-1 text-sm text-gray-900">${(data.organization.annual_revenue / 1000000).toFixed(1)}M</p>
                                </div>
                              )}
                            </div>
                            {data.organization.keywords && data.organization.keywords.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-gray-500 block mb-2">Keywords</span>
                                <div className="flex flex-wrap gap-2">
                                  {data.organization.keywords.map((keyword, index) => (
                                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.organization.technologies && data.organization.technologies.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-gray-500 block mb-2">Technologies</span>
                                <div className="flex flex-wrap gap-2">
                                  {data.organization.technologies.map((tech, index) => (
                                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {tech}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.organization.short_description && (
                              <div>
                                <span className="text-xs font-medium text-gray-500 block mb-2">About</span>
                                <div className="text-sm text-gray-600 bg-white rounded-md p-3 border border-gray-200">
                                  {data.organization.short_description}
                                </div>
                              </div>
                            )}
                          </div>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 