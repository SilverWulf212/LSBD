CREATE SCHEMA IF NOT EXISTS lsbd_raw;
CREATE TABLE IF NOT EXISTS lsbd_raw._sync_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  mode text NOT NULL,
  status text NOT NULL,
  tables_changed text[],
  inserted integer,
  updated integer,
  deleted integer,
  orphans_skipped integer,
  error text,
  blocked_tables text[],
  schema_drift text[]
);
REVOKE ALL ON lsbd_raw._sync_runs FROM anon, authenticated;
ALTER TABLE lsbd_raw._sync_runs ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS lsbd_raw._sync_tables (
  table_name text PRIMARY KEY,
  source_count bigint,
  source_fingerprint bigint,
  raw_live_count bigint,
  last_changed_at timestamptz,
  last_synced_at timestamptz
);
REVOKE ALL ON lsbd_raw._sync_tables FROM anon, authenticated;
ALTER TABLE lsbd_raw._sync_tables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."ADDRESS" (
  "AddressID" uuid,
  "LinkID" uuid,
  "Address1" text,
  "Address2" text,
  "Address3" text,
  "CityID" uuid,
  "StateID" uuid,
  "PostalCode" text,
  "CountryID" uuid,
  "AddressTypeID" uuid,
  "ParishID" uuid,
  "IsCurrent" boolean,
  "Mailing" boolean,
  "Updated" timestamp,
  "Home" boolean,
  "FLG_DUP" boolean,
  "CITY" text,
  "STATE" text,
  "COUNTRY" text,
  "Individual_ID" integer,
  "Office_ID" integer,
  "Address_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."ADDRESS" FROM anon, authenticated;
ALTER TABLE lsbd_raw."ADDRESS" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Activity" (
  _rowid bigserial PRIMARY KEY,
  "ActivityID" uuid,
  "Subject" text,
  "Details" text,
  "Updated" timestamp,
  "UpdatedBy" uuid,
  "Attachment" bytea,
  "DisciplinaryID" uuid,
  "RequiresReview" boolean,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Activity" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Activity" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."AddressHistory" (
  "ID" integer NOT NULL PRIMARY KEY,
  "LICENSEID" text,
  "Type" text,
  "FIRSTName" text,
  "MIDDLE" text,
  "LASTName" text,
  "Address1" text,
  "Address2" text,
  "CITY" text,
  "STATE" text,
  "ZIP" text,
  "COUNTY" text,
  "Email" text,
  "AddressO1" text,
  "AddressO2" text,
  "CITYO" text,
  "STATEO" text,
  "ZIPO" text,
  "COUNTYO" text,
  "Updated" timestamp,
  "UpdatedBy" text,
  "OPT_IN" text,
  "DEANO" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."AddressHistory" FROM anon, authenticated;
ALTER TABLE lsbd_raw."AddressHistory" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."AddressType" (
  "AddressTypeID" uuid,
  "AddressType" text,
  "AddressType_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."AddressType" FROM anon, authenticated;
ALTER TABLE lsbd_raw."AddressType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Announcements" (
  "ANNOUNC_ID" uuid,
  "ANNOUNC_SUBJECT" text,
  "ANNOUNC_ANNOUNCEMENTS" text,
  "ANNOUNC_EXP_DATE" timestamp,
  "ANNOUNC_ACTIVE" boolean,
  "CAT_ID" uuid,
  "ANNOUNCID" integer NOT NULL PRIMARY KEY,
  "CATEGORY" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Announcements" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Announcements" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."AssociationHistory" (
  "ID" integer NOT NULL PRIMARY KEY,
  "LicenseID" text,
  "LicenseType" text,
  "AssociatedLicenseID" text,
  "AssociatedLicenseType" text,
  "OperationType" text,
  "Updated" timestamp,
  "UpdatedBy" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."AssociationHistory" FROM anon, authenticated;
ALTER TABLE lsbd_raw."AssociationHistory" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."BoardMembers" (
  "BoardMemberID" uuid,
  "FullName" text,
  "Title" text,
  "Address1" text,
  "Address2" text,
  "DisplayOrderOverride" integer,
  "BoardMember_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."BoardMembers" FROM anon, authenticated;
ALTER TABLE lsbd_raw."BoardMembers" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Catagory" (
  "CAT_ID" uuid,
  "CAT_DESC" text,
  "CAT_ACTIVE" boolean,
  "CAT_TYPE" smallint,
  "CATID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Catagory" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Catagory" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Cities" (
  "CityID" uuid,
  "City" text,
  "City_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Cities" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Cities" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Control" (
  _rowid bigserial PRIMARY KEY,
  "ExportTempUpdt" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Control" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Control" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Countries" (
  "CountryID" uuid,
  "Country" text,
  "Country_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Countries" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Countries" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Disciplinary" (
  "DisciplinaryID" uuid,
  "IndividualID" uuid,
  "StartDate" timestamp,
  "EndDate" timestamp,
  "Notes" text,
  "Updated" timestamp,
  "GoodStanding" boolean,
  "UpdatedBy" uuid,
  "Individual_ID" integer,
  "Disciplinary_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Disciplinary" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Disciplinary" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Education" (
  "EducationID" uuid,
  "ProfessionalID" uuid,
  "EducationTypeID" uuid,
  "School" text,
  "GraduationDate" timestamp,
  "Updated" timestamp,
  "SchoolStateID" uuid,
  "BoardCertified" boolean,
  "CertifiedBy" text,
  "CertificationDate" timestamp,
  "STATE" text,
  "EDUTYPE" text,
  "Professional_ID" integer,
  "Individual_ID" integer,
  "Education_ID" integer NOT NULL PRIMARY KEY,
  "DenHygID" integer,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Education" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Education" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."EducationType" (
  "EducationTypeID" uuid,
  "EducationType" text,
  "EducationType_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."EducationType" FROM anon, authenticated;
ALTER TABLE lsbd_raw."EducationType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."ElectionDistricts" (
  "ElectionDistrictID" uuid,
  "ZipCode" text,
  "ParishID" uuid,
  "District" smallint,
  "PARISH" text,
  "ElectionDistrict_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."ElectionDistricts" FROM anon, authenticated;
ALTER TABLE lsbd_raw."ElectionDistricts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."FAQS" (
  "FAQS_ID" uuid,
  "FAQS_QUESTIONS" text,
  "FAQS_ANSWERS" text,
  "FAQS_ACTIVE" boolean,
  "CAT_ID" uuid,
  "CATEGORY" text,
  "FAQSID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."FAQS" FROM anon, authenticated;
ALTER TABLE lsbd_raw."FAQS" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Individual" (
  "IndividualID" uuid,
  "LastName" text,
  "FirstName" text,
  "MiddleName" text,
  "MarriedName" text,
  "LicenseName" text,
  "Suffix" text,
  "Prefix" text,
  "UseLicenseName" boolean,
  "SSN" text,
  "DOB" timestamp,
  "Sex" text,
  "Race" text,
  "Email" text,
  "WebSite" text,
  "ProcessingGroup" text,
  "Notes" text,
  "Updated" timestamp,
  "IndividualStatusID" uuid,
  "ID" integer,
  "STATUS" text,
  "INDVID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Individual" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Individual" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."IndividualAffiliation" (
  "IndividualAffiliationID" uuid,
  "DentistID" uuid,
  "IndividualID" uuid,
  "DENTID" integer,
  "INDVID" integer,
  "IndividualAffiliation_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."IndividualAffiliation" FROM anon, authenticated;
ALTER TABLE lsbd_raw."IndividualAffiliation" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."IndividualStatus" (
  "IndividualStatusID" uuid,
  "Status" text,
  "ProcessRenewal" boolean,
  "IndividualStatus_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."IndividualStatus" FROM anon, authenticated;
ALTER TABLE lsbd_raw."IndividualStatus" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."InspectionDetails" (
  "InspectionDetailID" uuid,
  "InspectionID" uuid,
  "IndividualID" uuid,
  "LastName" text,
  "FirstName" text,
  "MiddleName" text,
  "MarriedName" text,
  "LicenseName" text,
  "Suffix" text,
  "Prefix" text,
  "Role" text,
  "A_1" boolean,
  "A_2" boolean,
  "A_3" boolean,
  "A_4" boolean,
  "A_5" boolean,
  "A_6" boolean,
  "A_7" boolean,
  "A_8" boolean,
  "A_9" boolean,
  "INDVID" integer,
  "INSPECTID" integer,
  "InspectionDetail_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."InspectionDetails" FROM anon, authenticated;
ALTER TABLE lsbd_raw."InspectionDetails" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."InspectionStatus" (
  "InspectionStatusID" uuid,
  "InspectionStatus" text,
  "InspectionStatus_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."InspectionStatus" FROM anon, authenticated;
ALTER TABLE lsbd_raw."InspectionStatus" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Inspections" (
  "InspectionID" uuid,
  "OfficeID" uuid,
  "InspectionDate" timestamp,
  "InspectionNote" text,
  "Score" integer,
  "D_1" text,
  "D_1_List" text,
  "D_1_Notes" text,
  "D_2" text,
  "E_1" text,
  "E_1_Notes" text,
  "InspectorID" uuid,
  "InspectionStatusID" uuid,
  "Address1" text,
  "Address2" text,
  "Address3" text,
  "City" text,
  "State" text,
  "PostalCode" text,
  "C_1_List" text,
  "C_1_Notes" text,
  "C_2" text,
  "C_3" text,
  "C_4" text,
  "E_2" text,
  "E_2_List" text,
  "E_2_Notes" text,
  "Phone" text,
  "Violations" text,
  "INSPECTID" integer NOT NULL PRIMARY KEY,
  "OFFICE_ID" integer,
  "STATUS" text,
  "Inspector" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Inspections" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Inspections" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Logins" (
  "ID" integer NOT NULL PRIMARY KEY,
  "LicenseID" text NOT NULL,
  "LicType" text NOT NULL,
  "LoginDate" timestamp NOT NULL,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Logins" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Logins" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Office" (
  "OfficeID" uuid,
  "OfficeName" text,
  "Updated" timestamp,
  "OldOfficeID" integer,
  "Phone" text,
  "OFFICE_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Office" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Office" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."OfficeAffHistory" (
  "ID" integer NOT NULL PRIMARY KEY,
  "LicenseID" text,
  "LicenseType" text,
  "OfficeID" integer,
  "OperationType" text,
  "Updated" timestamp,
  "UpdatedBy" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."OfficeAffHistory" FROM anon, authenticated;
ALTER TABLE lsbd_raw."OfficeAffHistory" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."OfficeAffiliation" (
  "OfficeAffiliationID" uuid,
  "DentistID" uuid,
  "OfficeID" uuid,
  "OfficePermit" boolean,
  "DENTIST_ID" integer,
  "OFFICE_ID" integer,
  "OfficeAffiliation_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."OfficeAffiliation" FROM anon, authenticated;
ALTER TABLE lsbd_raw."OfficeAffiliation" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Parishes" (
  "ParishID" uuid,
  "Parish" text,
  "Parish_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Parishes" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Parishes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."PermitHistory" (
  "ID" integer NOT NULL PRIMARY KEY,
  "LicenseID" integer NOT NULL,
  "PermitType" text NOT NULL,
  "OfficeID" integer,
  "OperationType" text NOT NULL,
  "Updated" timestamp NOT NULL,
  "UpdatedBy" text NOT NULL,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."PermitHistory" FROM anon, authenticated;
ALTER TABLE lsbd_raw."PermitHistory" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."PermitType" (
  "PermitTypeID" uuid,
  "PermitType" text,
  "PersonalFee" numeric,
  "OfficeFee" numeric,
  "PermitType_ID" integer NOT NULL PRIMARY KEY,
  "Description" text,
  "PersonalPriority" integer,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."PermitType" FROM anon, authenticated;
ALTER TABLE lsbd_raw."PermitType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Permits" (
  "PermitsID" uuid,
  "PermitTypeID" uuid,
  "DentistID" uuid,
  "OfficeID" uuid,
  "Updated" timestamp,
  "Permits_ID" integer NOT NULL PRIMARY KEY,
  "PermitType" text,
  "Dentist_ID" integer,
  "Office_ID" integer,
  "PermitLevel" text,
  "Description" text,
  "IssueDate" timestamp,
  "UpdatedOnline" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Permits" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Permits" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."PracticeType" (
  "PracticeTypeID" uuid,
  "PracticeType" text,
  "Specialty" boolean,
  "PracticeType_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."PracticeType" FROM anon, authenticated;
ALTER TABLE lsbd_raw."PracticeType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Professional" (
  "ProfessionalID" uuid,
  "ProfessionalTypeID" uuid,
  "PracticeTypeID" uuid,
  "IndividualID" uuid,
  "LicenseNumber" text,
  "Original_Lic_Issue_Date" timestamp,
  "Creditial_Exam" text,
  "AuditYear" text,
  "Updated" timestamp,
  "Inactive" boolean,
  "CSNone" boolean,
  "CSDispense" boolean,
  "CSAdminister" boolean,
  "Professional_ID" integer NOT NULL PRIMARY KEY,
  "ProfessionalType" text,
  "PracticeType" text,
  "Individual_ID" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Professional" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Professional" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."ProfessionalType" (
  "ProfessionalTypeID" uuid,
  "ProfessionalType" text,
  "LICSCode" text,
  "RenewalFee" numeric,
  "LateFee" numeric,
  "FirstTimeFee" numeric,
  "ProfessionalType_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."ProfessionalType" FROM anon, authenticated;
ALTER TABLE lsbd_raw."ProfessionalType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."RenewalCertification" (
  "ID" integer NOT NULL PRIMARY KEY,
  "DenHygID" integer NOT NULL,
  "Year" integer NOT NULL,
  "AnesIncident" text,
  "Convicted" text,
  "Discipline" text,
  "CE" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."RenewalCertification" FROM anon, authenticated;
ALTER TABLE lsbd_raw."RenewalCertification" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."RenewalDetails" (
  "RenewalDetailID" uuid,
  "RenewalID" uuid,
  "PermitID" uuid,
  "Printed" timestamp,
  "RenewalDetail_ID" integer NOT NULL PRIMARY KEY,
  "Renewal_ID" integer,
  "Permit_ID" integer,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."RenewalDetails" FROM anon, authenticated;
ALTER TABLE lsbd_raw."RenewalDetails" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."RenewalSettings" (
  "ID" integer NOT NULL PRIMARY KEY,
  "LicenseType" text NOT NULL,
  "ExpirationDate" timestamp NOT NULL,
  "RenewalDate" timestamp NOT NULL,
  "Fee" numeric NOT NULL,
  "WellBeingFee" numeric NOT NULL,
  "LateFee" numeric NOT NULL,
  "StartDate" timestamp NOT NULL,
  "LateDate" timestamp NOT NULL,
  "EndDate" timestamp NOT NULL,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."RenewalSettings" FROM anon, authenticated;
ALTER TABLE lsbd_raw."RenewalSettings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Renewals" (
  "RenewalID" uuid,
  "IndividualID" uuid,
  "AppPrinted" timestamp,
  "LicensePrinted" timestamp,
  "RenewalAmount" numeric,
  "RenewalYear" text,
  "TransactionDate" timestamp,
  "LastUpdate" timestamp,
  "AmountPaid" numeric,
  "pPermitPrinted" timestamp,
  "oPermitPrinted" timestamp,
  "Individual_ID" integer,
  "Renewal_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Renewals" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Renewals" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Specialty" (
  _rowid bigserial PRIMARY KEY,
  "SpecialtyID" uuid,
  "ProfessionalD" uuid,
  "Institution" text,
  "SpecialtyDate" timestamp,
  "BoardCertified" boolean,
  "CertifiedBy" text,
  "CertifiedDate" timestamp,
  "Updated" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Specialty" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Specialty" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."States" (
  "StateID" uuid,
  "State" text,
  "State_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."States" FROM anon, authenticated;
ALTER TABLE lsbd_raw."States" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."StatuteViolations" (
  _rowid bigserial PRIMARY KEY,
  "StatuteViolationID" uuid,
  "DisciplinaryID" uuid,
  "StatuteID" uuid,
  "ViolationDate" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."StatuteViolations" FROM anon, authenticated;
ALTER TABLE lsbd_raw."StatuteViolations" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Statutes" (
  _rowid bigserial PRIMARY KEY,
  "StatuteID" uuid,
  "Statute" text,
  "StatuteTitle" text,
  "Notes" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Statutes" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Statutes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Users" (
  "UserID" uuid,
  "UserName" text,
  "AccessLevel" smallint,
  "EmailAddress" text,
  "FullName" text,
  "SR_Col_1_Width" integer,
  "SR_Col_2_Width" integer,
  "Inspector" boolean,
  "Title" text,
  "Phone" text,
  "User_ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Users" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Users" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."Zipcodes" (
  "City" text,
  "State" text,
  "zip" text,
  "Area Code" text,
  "County" text,
  "State Code" text,
  "Time Zone" text,
  "Longitude" text,
  "Latitude" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."Zipcodes" FROM anon, authenticated;
ALTER TABLE lsbd_raw."Zipcodes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblASPermits" (
  "LicenseId" text,
  "DateSince" timestamp,
  "Type" text,
  "STATUS" text,
  "DateInactive" timestamp,
  "DateReinstate" timestamp,
  "DLicenseId" text,
  "OtherDentists" text,
  "TRAINING" text,
  "TRAINYEAR" text,
  "Key" integer NOT NULL PRIMARY KEY,
  "DateUntil" timestamp,
  "DateUpdated" timestamp,
  "DateRenew" timestamp,
  "RegYear" text,
  "InspectedO" text,
  "Inspected" text,
  "RenewMnth" text,
  "Notes" text,
  "InspectedS1" text,
  "InspectedS2" text,
  "Audit" text,
  "SLEVEL" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblASPermits" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblASPermits" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblChargeCategory" (
  "CHARGE_CAT" text,
  "DESCRIPT" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblChargeCategory" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblChargeCategory" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblChargeInt" (
  "INT_CHRG" text,
  "DESCRIPT" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblChargeInt" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblChargeInt" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblClass" (
  "Class" text,
  "ClassDesc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  "LoginOk" boolean NOT NULL,
  "RenewOk" boolean NOT NULL,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblClass" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblClass" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplActions" (
  "Action" text,
  "Desc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplActions" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplActions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplClosure" (
  "Closure" text,
  "Desc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplClosure" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplClosure" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplDecisions" (
  "Decision" text,
  "Desc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplDecisions" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplDecisions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplHearings" (
  "Hearing" text,
  "Desc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplHearings" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplHearings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplProbation" (
  "Probation" text,
  "Desc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplProbation" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplProbation" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplStatus" (
  "ID" integer NOT NULL PRIMARY KEY,
  "Status" text,
  "Description" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplStatus" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplStatus" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblComplaints" (
  "Key" integer NOT NULL PRIMARY KEY,
  "LICENSEID" text,
  "LOG_NO" text,
  "LOG_DT" timestamp,
  "CLOSE_DT" timestamp,
  "DECIS_DT" timestamp,
  "LAST_VISIT" timestamp,
  "OPEN" text,
  "STATUS" text,
  "INT_CHRG1" text,
  "INT_CHRG2" text,
  "INT_CHRG3" text,
  "CHRGE_CAT1" text,
  "CHRGE_CAT2" text,
  "CHRGE_CAT3" text,
  "CHARGE1" text,
  "CHARGE2" text,
  "CHARGE3" text,
  "BOARDMEMBR" text,
  "INVESTIGTR" text,
  "COMPLNANT" text,
  "HEARING" text,
  "DEC_TYPE" text,
  "ACTION" text,
  "SUSP_PRD" text,
  "SUSP_BEGIN" timestamp,
  "SUSP_END" timestamp,
  "PROB_PRD" text,
  "PROB_BEGIN" timestamp,
  "PROB_END" timestamp,
  "CE_COURSES" text,
  "CE_AREA1" text,
  "CE_HOURS1" double precision,
  "CE_AREA2" text,
  "CE_HOURS2" double precision,
  "COUNSELING" text,
  "COMMENTS" text,
  "ATT_NAME" text,
  "ATT_FIRM" text,
  "ATT_STR1" text,
  "ATT_STR2" text,
  "ATT_CITY" text,
  "ATT_STATE" text,
  "ATT_ZIP" text,
  "ATT_PHONE" text,
  "att_ext" text,
  "ClosureTerms" text,
  "ProbTerms" text,
  "Address1C" text,
  "Address2C" text,
  "CITYC" text,
  "STATEC" text,
  "ZIPC" text,
  "COUNTYC" text,
  "PhoneC" text,
  "ExtC" text,
  "FaxC" text,
  "LICTYPE" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblComplaints" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblComplaints" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblCounties" (
  "ID" integer NOT NULL PRIMARY KEY,
  "County" text,
  "CountyName" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblCounties" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblCounties" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblDates" (
  "ID" integer NOT NULL PRIMARY KEY,
  "IndRegExp" timestamp,
  "IndRnwExp" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblDates" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblDates" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblDenHyg" (
  "Key" integer NOT NULL PRIMARY KEY,
  "LICENSEID" text,
  "Type" text,
  "Class" text,
  "STATUS" text,
  "DateSince" timestamp,
  "DateInactive" timestamp,
  "DateReinstate" timestamp,
  "DateUpdated" timestamp,
  "DateRenew" timestamp,
  "DateUntil" timestamp,
  "RegYear" text,
  "PANO" text,
  "PLLCNO" text,
  "PERMITNO" text,
  "FIRSTName" text,
  "MIDDLE" text,
  "LASTName" text,
  "DOB" timestamp,
  "SEX" text,
  "RACE" text,
  "SPECIALTY" text,
  "ACTIVE" text,
  "INACTIVE" text,
  "PRINSET" text,
  "FORMEMPL" text,
  "HRSWK" double precision,
  "PATIENTCR" double precision,
  "NUMDENT" double precision,
  "NUMHYGEN" double precision,
  "NUMDA1" double precision,
  "NUMDA2" double precision,
  "SATCITY1" text,
  "SATCITY2" text,
  "CEHrs" double precision,
  "USEANES" text,
  "USESEDAT" text,
  "Address1" text,
  "Address2" text,
  "CITY" text,
  "STATE" text,
  "ZIP" text,
  "COUNTY" text,
  "AddrType" text,
  "COMPLAINT" text,
  "SSN" text,
  "Email" text,
  "URL" text,
  "Location" text,
  "Phone1" text,
  "Ext1" text,
  "Phone2" text,
  "Ext2" text,
  "Fax" text,
  "Notes" text,
  "AddressO1" text,
  "AddressO2" text,
  "CITYO" text,
  "STATEO" text,
  "ZIPO" text,
  "COUNTYO" text,
  "OAddrType" text,
  "SCHNAME" text,
  "SCHSTATE" text,
  "GRADYEAR" smallint,
  "DEGREE" smallint,
  "RenewMnth" text,
  "AddressP1" text,
  "AddressP2" text,
  "CITYP" text,
  "STATEP" text,
  "ZIPP" text,
  "COUNTYP" text,
  "Audit" text,
  "Action" text,
  "BACKGROUND" boolean,
  "CPR" text,
  "CENOTREQ" text,
  "Fax2" text,
  "LimitedSupDH" text,
  "LicenseName" text,
  "MarriedName" text,
  "Prefix" text,
  "Suffix" text,
  "ProcessingGroup" text,
  "IndividualID_" integer,
  "IndividualID" uuid,
  "Updated" timestamp,
  "ID" integer,
  "UseLicenseName" boolean,
  "IsCurrent" boolean,
  "Address3" text,
  "Country" text,
  "CSNone" boolean,
  "CSDispense" boolean,
  "CSAdminister" boolean,
  "AuditYear" text,
  "Credential_Exam" text,
  "INACTIVE2" boolean,
  "UpdatedBy" text,
  "OPT_IN" text,
  "DEANO" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblDenHyg" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblDenHyg" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblDisposition" (
  "ID" integer NOT NULL PRIMARY KEY,
  "Disposition" text,
  "Description" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblDisposition" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblDisposition" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblExamsDent" (
  "Key1" integer,
  "LicenseId" text,
  "PrepAmal" numeric,
  "RestAmal" numeric,
  "PrepComp" numeric,
  "RestComp" numeric,
  "Endo" numeric,
  "AvgLab" numeric,
  "Pros" numeric,
  "Perio" numeric,
  "Written" numeric,
  "Juris" numeric,
  "Sterile" numeric,
  "GRADE" numeric,
  "Remarks" text,
  "NatBoardScores" boolean,
  "DenHygSchoolTrans" boolean,
  "OtherTrans" boolean,
  "Photos" boolean,
  "ExamFee" boolean,
  "RecoLetters" boolean,
  "RegisLetter" boolean,
  "CompleteAppl" boolean,
  "LicensureCert" boolean,
  "InsuranceVerify" boolean,
  "DataBankRpt" boolean,
  "ID" integer NOT NULL PRIMARY KEY,
  "TIMESTAMP" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblExamsDent" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblExamsDent" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblExamsHyg" (
  "Key1" integer,
  "Licenseid" text,
  "Clinical" text,
  "Juris" text,
  "Sterile" text,
  "JURIS2" text,
  "STERILE2" text,
  "PassFail" text,
  "Remarks" text,
  "NatBoardScores" boolean,
  "DenHygSchoolTrans" boolean,
  "OtherTrans" boolean,
  "Photos" boolean,
  "ExamFee" boolean,
  "RecoLetters" boolean,
  "RegisLetter" boolean,
  "CompleteAppl" boolean,
  "LicensureCert" boolean,
  "InsuranceVerify" boolean,
  "ID" integer NOT NULL PRIMARY KEY,
  "TIMESTAMP" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblExamsHyg" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblExamsHyg" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblFees" (
  "ID" integer NOT NULL PRIMARY KEY,
  "DenRegFee" numeric,
  "HygRegFee" numeric,
  "PARegFee" numeric,
  "PLLCRegFee" numeric,
  "ASRegFee" numeric,
  "IntRegFee" numeric,
  "PrvRegFee" numeric,
  "DenRnwFee" numeric,
  "HygRnwFee" numeric,
  "PARnwFee" numeric,
  "PLLCRnwFee" numeric,
  "ASRnwFee" numeric,
  "IntRnwFee" numeric,
  "PrvRnwFee" numeric,
  "DenLateFee" numeric,
  "HygLateFee" numeric,
  "PALateFee" numeric,
  "PLLCLateFee" numeric,
  "ASLateFee" numeric,
  "IntLateFee" numeric,
  "PrvLateFee" numeric,
  "DenAssFee" numeric,
  "HygAssFee" numeric,
  "IntAssFee" numeric,
  "PrvAssFee" numeric,
  "DenReinFee" numeric,
  "HygReinFee" numeric,
  "PAReinFee" numeric,
  "PLLCReinFee" numeric,
  "ASReinFee" numeric,
  "IntReinFee" numeric,
  "PrvReinFee" numeric,
  "VolDenRnwFee" numeric,
  "VolDenRegFee" numeric,
  "VolHygRnwFee" numeric,
  "VolHygRegFee" numeric,
  "CreDenRegFee" numeric,
  "CreHygRegFee" numeric,
  "InsDenRnwFee" numeric,
  "InsDenRegFee" numeric,
  "WellBeingFeeDen" numeric,
  "WellBeingFeeHyg" numeric,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblFees" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblFees" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblFormEmpl" (
  "ID" text NOT NULL PRIMARY KEY,
  "FormEmploy" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblFormEmpl" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblFormEmpl" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblNumbers" (
  "ID" integer NOT NULL PRIMARY KEY,
  "DID" integer,
  "DAPPID" integer,
  "HID" integer,
  "HAPPID" integer,
  "ASID" integer,
  "INTID" integer,
  "PAID" integer,
  "PLLCID" integer,
  "TRANSID" integer,
  "CMPID" integer,
  "VOLDENID" integer,
  "VOLHYGID" integer,
  "INSDENID" integer,
  "INSHYGID" integer,
  "NLID" integer,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblNumbers" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblNumbers" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblPAs" (
  "LICENSEID" text,
  "DateSince" timestamp,
  "ESTNAME" text,
  "STATUS" text,
  "DateUpdated" timestamp,
  "ADDR_NAME1" text,
  "ADDR_NAME2" text,
  "SORT1" text,
  "SORT2" text,
  "COMMENT1" text,
  "COMMENT2" text,
  "COMMENT3" text,
  "DateRenew" timestamp,
  "DateUntil" timestamp,
  "RenewMnth" text,
  "Key" integer NOT NULL PRIMARY KEY,
  "ADDRESS1" text,
  "ADDRESS2" text,
  "CITY" text,
  "STATE" text,
  "ZIP" text,
  "COUNTY" text,
  "Phone1" text,
  "Ext1" text,
  "Phone2" text,
  "Ext2" text,
  "Fax" text,
  "Notes" text,
  "RegYear" text,
  "Location" text,
  "Email" text,
  "URL" text,
  "Type" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblPAs" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblPAs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblPLLCs" (
  "LICENSEID" text,
  "DateSince" timestamp,
  "ESTNAME" text,
  "STATUS" text,
  "DateUpdated" timestamp,
  "ADDR_NAME1" text,
  "ADDR_NAME2" text,
  "SORT1" text,
  "SORT2" text,
  "COMMENT1" text,
  "COMMENT2" text,
  "COMMENT3" text,
  "DateRenew" timestamp,
  "DateUntil" timestamp,
  "RenewMnth" text,
  "Key" integer NOT NULL PRIMARY KEY,
  "ADDRESS1" text,
  "ADDRESS2" text,
  "CITY" text,
  "STATE" text,
  "ZIP" text,
  "COUNTY" text,
  "Phone1" text,
  "Ext1" text,
  "Phone2" text,
  "Ext2" text,
  "Fax" text,
  "Notes" text,
  "RegYear" text,
  "Location" text,
  "Email" text,
  "URL" text,
  "Type" text,
  "OfficeID" uuid,
  "Office_ID" integer,
  "OldOfficeID" integer,
  "ADDRESS3" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblPLLCs" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblPLLCs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblPrinSet" (
  "ID" integer NOT NULL PRIMARY KEY,
  "PrinSet" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblPrinSet" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblPrinSet" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblReportType" (
  "ID" integer NOT NULL PRIMARY KEY,
  "ReportType" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblReportType" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblReportType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblRndAnesthesia" (
  "LicenseId" text,
  "DateSince" timestamp,
  "Type" text,
  "STATUS" text,
  "DateInactive" timestamp,
  "DateReinstate" timestamp,
  "DLicenseId" text,
  "OtherDentists" text,
  "TRAINING" text,
  "TRAINYEAR" text,
  "Key" integer NOT NULL PRIMARY KEY,
  "DateUntil" timestamp,
  "DateUpdated" timestamp,
  "DateRenew" timestamp,
  "RegYear" text,
  "InspectedO" text,
  "Inspected" text,
  "RenewMnth" text,
  "Notes" text,
  "InspectedS1" text,
  "InspectedS2" text,
  "Audit" text,
  "SLEVEL" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblRndAnesthesia" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblRndAnesthesia" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblRndDentists" (
  "Key" integer NOT NULL PRIMARY KEY,
  "LICENSEID" text,
  "Type" text,
  "Class" text,
  "STATUS" text,
  "DateSince" timestamp,
  "DateInactive" timestamp,
  "DateReinstate" timestamp,
  "DateUpdated" timestamp,
  "DateRenew" timestamp,
  "DateUntil" timestamp,
  "RegYear" text,
  "PANO" text,
  "PLLCNO" text,
  "PERMITNO" text,
  "FIRSTName" text,
  "MIDDLE" text,
  "LASTName" text,
  "DOB" timestamp,
  "SEX" text,
  "RACE" text,
  "SPECIALTY" text,
  "ACTIVE" text,
  "INACTIVE" text,
  "PRINSET" text,
  "FORMEMPL" text,
  "HRSWK" double precision,
  "PATIENTCR" double precision,
  "NUMDENT" double precision,
  "NUMHYGEN" double precision,
  "NUMDA1" double precision,
  "NUMDA2" double precision,
  "SATCITY1" text,
  "SATCITY2" text,
  "CEHrs" double precision,
  "USEANES" text,
  "USESEDAT" text,
  "Address1" text,
  "Address2" text,
  "CITY" text,
  "STATE" text,
  "ZIP" text,
  "COUNTY" text,
  "AddrType" text,
  "COMPLAINT" text,
  "SSN" text,
  "Email" text,
  "URL" text,
  "Location" text,
  "Phone1" text,
  "Ext1" text,
  "Phone2" text,
  "Ext2" text,
  "Fax" text,
  "Notes" text,
  "AddressO1" text,
  "AddressO2" text,
  "CITYO" text,
  "STATEO" text,
  "ZIPO" text,
  "COUNTYO" text,
  "OAddrType" text,
  "SCHNAME" text,
  "SCHSTATE" text,
  "GRADYEAR" smallint,
  "DEGREE" smallint,
  "RenewMnth" text,
  "AddressP1" text,
  "AddressP2" text,
  "CITYP" text,
  "STATEP" text,
  "ZIPP" text,
  "COUNTYP" text,
  "Audit" text,
  "Action" text,
  "BACKGROUND" boolean,
  "CPR" text,
  "CENOTREQ" text,
  "Fax2" text,
  "LimitedSupDH" text,
  "LicenseName" text,
  "MarriedName" text,
  "Prefix" text,
  "Suffix" text,
  "ProcessingGroup" text,
  "IndividualID_" integer,
  "IndividualID" uuid,
  "Updated" timestamp,
  "ID" integer,
  "UseLicenseName" boolean,
  "IsCurrent" boolean,
  "Address3" text,
  "Country" text,
  "CSNone" boolean,
  "CSDispense" boolean,
  "CSAdminister" boolean,
  "AuditYear" text,
  "Credential_Exam" text,
  "INACTIVE2" boolean,
  "UpdatedBy" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblRndDentists" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblRndDentists" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblRndHygienists" (
  "Key" integer NOT NULL PRIMARY KEY,
  "LICENSEID" text,
  "Type" text,
  "Class" text,
  "STATUS" text,
  "DateSince" timestamp,
  "DateInactive" timestamp,
  "DateReinstate" timestamp,
  "DateUpdated" timestamp,
  "DateRenew" timestamp,
  "DateUntil" timestamp,
  "RegYear" text,
  "PANO" text,
  "PLLCNO" text,
  "PERMITNO" text,
  "FIRSTName" text,
  "MIDDLE" text,
  "LASTName" text,
  "DOB" timestamp,
  "SEX" text,
  "RACE" text,
  "SPECIALTY" text,
  "ACTIVE" text,
  "INACTIVE" text,
  "PRINSET" text,
  "FORMEMPL" text,
  "HRSWK" double precision,
  "PATIENTCR" double precision,
  "NUMDENT" double precision,
  "NUMHYGEN" double precision,
  "NUMDA1" double precision,
  "NUMDA2" double precision,
  "SATCITY1" text,
  "SATCITY2" text,
  "CEHrs" double precision,
  "USEANES" text,
  "USESEDAT" text,
  "Address1" text,
  "Address2" text,
  "CITY" text,
  "STATE" text,
  "ZIP" text,
  "COUNTY" text,
  "AddrType" text,
  "COMPLAINT" text,
  "SSN" text,
  "Email" text,
  "URL" text,
  "Location" text,
  "Phone1" text,
  "Ext1" text,
  "Phone2" text,
  "Ext2" text,
  "Fax" text,
  "Notes" text,
  "AddressO1" text,
  "AddressO2" text,
  "CITYO" text,
  "STATEO" text,
  "ZIPO" text,
  "COUNTYO" text,
  "OAddrType" text,
  "SCHNAME" text,
  "SCHSTATE" text,
  "GRADYEAR" smallint,
  "DEGREE" smallint,
  "RenewMnth" text,
  "AddressP1" text,
  "AddressP2" text,
  "CITYP" text,
  "STATEP" text,
  "ZIPP" text,
  "COUNTYP" text,
  "Audit" text,
  "Action" text,
  "BACKGROUND" boolean,
  "CPR" text,
  "CENOTREQ" text,
  "Fax2" text,
  "LimitedSupDH" text,
  "LicenseName" text,
  "MarriedName" text,
  "Prefix" text,
  "Suffix" text,
  "ProcessingGroup" text,
  "IndividualID_" integer,
  "IndividualID" uuid,
  "Updated" timestamp,
  "ID" integer,
  "UseLicenseName" boolean,
  "IsCurrent" boolean,
  "Address3" text,
  "Country" text,
  "CSNone" boolean,
  "CSDispense" boolean,
  "CSAdminister" boolean,
  "AuditYear" text,
  "Credential_Exam" text,
  "INACTIVE2" boolean,
  "UpdatedBy" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblRndHygienists" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblRndHygienists" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblRndSedation" (
  "LicenseId" text,
  "DateSince" timestamp,
  "Type" text,
  "STATUS" text,
  "DateInactive" timestamp,
  "DateReinstate" timestamp,
  "DLicenseId" text,
  "OtherDentists" text,
  "TRAINING" text,
  "TRAINYEAR" text,
  "Key" integer NOT NULL PRIMARY KEY,
  "DateUntil" timestamp,
  "DateUpdated" timestamp,
  "DateRenew" timestamp,
  "RegYear" text,
  "InspectedO" text,
  "Inspected" text,
  "RenewMnth" text,
  "Notes" text,
  "InspectedS1" text,
  "InspectedS2" text,
  "Audit" text,
  "SLEVEL" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblRndSedation" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblRndSedation" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblSchools" (
  "SCHSTATE" text,
  "SCHNAME" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblSchools" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblSchools" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblSedLevels" (
  _rowid bigserial PRIMARY KEY,
  "ID" integer NOT NULL,
  "SLEVEL" text,
  "DESCRIPTION" text,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblSedLevels" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblSedLevels" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblSpecialties" (
  "Specialty" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblSpecialties" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblSpecialties" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblStatus" (
  "ID" integer NOT NULL PRIMARY KEY,
  "StatusId" text,
  "Status" text,
  "LoginOk" boolean NOT NULL,
  "RenewOk" boolean NOT NULL,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblStatus" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblStatus" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblTransSplits" (
  "ID" integer NOT NULL PRIMARY KEY,
  "TransId" integer,
  "Key" integer,
  "Licenseid" text,
  "Name" text,
  "Description" text,
  "RefNum" text,
  "Fee" double precision,
  "Type" text,
  "DateTrans" timestamp,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblTransSplits" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblTransSplits" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblTransTypes" (
  "TransType" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblTransTypes" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblTransTypes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblTransactions" (
  "ID" integer NOT NULL PRIMARY KEY,
  "TransId" integer,
  "Key" integer,
  "Licenseid" text,
  "Name" text,
  "Description" text,
  "DateDeposit" timestamp,
  "RENEWMNTH" text,
  "ExpYEAR" text,
  "RefNum" text,
  "DEPOSITNO" text,
  "Fee" double precision,
  "Penalty" double precision,
  "Total" double precision,
  "Type" text,
  "CEHrs" double precision,
  "Print" boolean,
  "AssFEE" double precision,
  "DateRenew" timestamp,
  "DateTrans" timestamp,
  "ISSUED" text,
  "DATESTMP" timestamp,
  "TIMESTMP" text,
  "PrintDate" timestamp,
  "MailDate" timestamp,
  "AppPrinted" timestamp,
  "LastUpdated" timestamp,
  "oPermitPrinted" timestamp,
  "pPermitPrinted" timestamp,
  "RenewalID" uuid,
  "IndividualID" uuid,
  "WellBeingFee" double precision,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblTransactions" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblTransactions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblTypes" (
  "Type" text,
  "TypeDesc" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblTypes" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblTypes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lsbd_raw."tblnactiveStatus" (
  "Status" text,
  "ID" integer NOT NULL PRIMARY KEY,
  _row_hash text NOT NULL,
  _synced_at timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);
REVOKE ALL ON lsbd_raw."tblnactiveStatus" FROM anon, authenticated;
ALTER TABLE lsbd_raw."tblnactiveStatus" ENABLE ROW LEVEL SECURITY;
