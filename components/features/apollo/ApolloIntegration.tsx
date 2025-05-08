import React, { useState, Fragment } from 'react';
import Image from 'next/image';
import { Attendee } from '@/types';
import { apolloService, ApolloContactCreate, ApolloEnrichmentResponse } from '@/lib/apollo';
import { ArrowPathIcon, ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import ApolloListModal from './ApolloListModal';
import { Dialog, Transition } from '@headlessui/react';

interface ApolloIntegrationProps {
  selectedAttendees: Attendee[];
  conferenceName: string;
  onEnrichmentComplete: (enrichedData: ApolloEnrichmentResponse) => void;
}

export default function ApolloIntegration({ 
  selectedAttendees,
  conferenceName,
  onEnrichmentComplete 
}: ApolloIntegrationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichedData, setEnrichedData] = useState<ApolloEnrichmentResponse[]>([]);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

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

      if (!enriched || !enriched.matches || enriched.matches.length === 0) {
        setError('No matches found in Apollo for the provided contact information');
        return;
      }

      setEnrichedData([enriched]);
      onEnrichmentComplete(enriched);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich contacts';
      setError(errorMessage);
      console.error('Enrichment error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushToApollo = () => {
    if (!conferenceName) {
      setError('Conference name is required');
      return;
    }
    setIsListModalOpen(true);
  };

  const handleListSelected = async (listName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert attendees to Apollo contacts
      const contacts: ApolloContactCreate[] = selectedAttendees.map(attendee => ({
        firstName: attendee.first_name,
        lastName: attendee.last_name,
        name: `${attendee.first_name} ${attendee.last_name}`,
        email: attendee.email || '',
        title: attendee.title || '',
        organization: attendee.health_systems?.name || attendee.company || '',
        phone: attendee.phone || '',
        linkedinUrl: attendee.linkedin_url || '',
      }));

      // Push contacts to Apollo with the selected list name as the label
      await apolloService.pushContactsToApollo(contacts, listName);
      
      setError(null);
      setIsSuccessModalOpen(true);
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

      <ApolloListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onListSelected={handleListSelected}
        defaultListName={conferenceName}
      />

      <Transition appear show={isSuccessModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsSuccessModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-30" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-center mb-4">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                    </div>
                  </div>
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 text-center">
                    Success!
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 text-center">
                      Contacts have been successfully pushed to Apollo.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      onClick={() => setIsSuccessModalOpen(false)}
                    >
                      Got it, thanks!
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {enrichedData.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Enriched Data</h4>
          <div className="space-y-4">
            {enrichedData.map((data, index) => (
              <div key={index} className="bg-white overflow-hidden shadow-lg border border-gray-100 rounded-xl">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
                  <div className="flex items-center">
                    {data.matches[0]?.photo_url ? (
                      <Image 
                        src={data.matches[0].photo_url} 
                        alt={`${data.matches[0].first_name} ${data.matches[0].last_name}`}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-full ring-2 ring-white shadow-sm mr-4 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-medium mr-4 ring-2 ring-white shadow-sm">
                        {data.matches[0]?.first_name[0]}{data.matches[0]?.last_name[0]}
                      </div>
                    )}
                    <div>
                      <h5 className="text-xl font-semibold text-gray-900">
                        {data.matches[0]?.first_name} {data.matches[0]?.last_name}
                      </h5>
                      {data.matches[0]?.headline && (
                        <p className="mt-1 text-sm text-gray-600">{data.matches[0].headline}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-6">
                  <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="col-span-1 space-y-6">
                      {data.matches[0]?.email && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500 flex items-center">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </dt>
                          <dd className="mt-2 text-sm text-gray-900 flex items-center">
                            {data.matches[0].email}
                            {data.matches[0].email_status && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {data.matches[0].email_status}
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                      {data.matches[0]?.phone && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500 flex items-center">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Phone
                          </dt>
                          <dd className="mt-2 text-sm text-gray-900">{data.matches[0].phone}</dd>
                        </div>
                      )}
                      <div className="rounded-lg bg-gray-50 p-4">
                        <dt className="text-sm font-medium text-gray-500">Social Profiles</dt>
                        <dd className="mt-2">
                          <div className="space-y-2">
                            {data.matches[0]?.linkedin_url && (
                              <a href={data.matches[0].linkedin_url} target="_blank" rel="noopener noreferrer" 
                                 className="flex items-center text-sm text-blue-600 hover:text-blue-500">
                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                                LinkedIn Profile
                              </a>
                            )}
                          </div>
                        </dd>
                      </div>
                    </div>
                    <div className="col-span-1 space-y-6">
                      {data.matches[0]?.employment_history && data.matches[0].employment_history.length > 0 && (
                        <div className="rounded-lg bg-gray-50 p-4">
                          <dt className="text-sm font-medium text-gray-500 mb-6 flex items-center">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Employment History
                          </dt>
                          <dd>
                            <ul className="-mb-8">
                              {data.matches[0].employment_history.map((job, index, array) => (
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
                      {data.matches[0]?.organization && (
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
                                <h4 className="text-lg font-medium text-gray-900">{data.matches[0].organization.name}</h4>
                                <div className="mt-2 flex space-x-3">
                                  {data.matches[0].organization.website_url && (
                                    <a href={data.matches[0].organization.website_url} target="_blank" rel="noopener noreferrer" 
                                       className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 border border-gray-200">
                                      <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                      </svg>
                                      Website
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                {data.matches[0].organization.industry && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500">Industry</span>
                                    <p className="mt-1 text-sm text-gray-900">{data.matches[0].organization.industry}</p>
                                  </div>
                                )}
                                {data.matches[0].organization.estimated_num_employees > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500">Employees</span>
                                    <p className="mt-1 text-sm text-gray-900">{data.matches[0].organization.estimated_num_employees.toLocaleString()}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </dd>
                        </div>
                      )}
                    </div>
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