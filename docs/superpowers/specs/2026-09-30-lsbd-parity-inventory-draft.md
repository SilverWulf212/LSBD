# LSBD Access application - functional inventory (DRAFT)

Generated 2026-09-30 by static extraction of copies of the two Access files (no row data, credentials scrubbed). Source files: `D:\Data\Users\Erin\DATA\TRANSFER 8-19-25\lsbdapp.mdb` (front-end, Jet/ACE .mdb, ~29 MB) and `D:\Data\common\Erin\ReportManager.accdb` (companion reports DB, ~9 MB). Raw structured data: `inventory-raw.json`.

Purposes below are **guesses from names, sources, filters and VBA call patterns**, not confirmed with staff. Query SQL is reconstructed from MSysQueries and is approximate (see caveats at the end).

## 1. Summary counts

| Object type | lsbdapp.mdb | ReportManager.accdb |
|---|---:|---:|
| Local (non-system) tables | 0 | 0 |
| ODBC linked tables (Type 4) | 47 | 20 |
| Linked Access tables (Type 6) | 0 | 0 |
| Queries (Type 5), total | 202 | 80 |
|   - user-visible saved queries | 139 | 80 |
|   - hidden `~sq_` embedded form/report row sources | 63 | 0 |
| Forms (-32768) | 55 | 0 |
| Reports (-32764) | 80 | 8 |
| Modules (-32761) | 20 | 0 |
| Macros (-32766) | 13 | 0 |
| Form/Report class modules with VBA (Form_*, Report_*) | 61 (see §7) | not extractable (accdb) |
| System tables (MSys*) | 11 | 26 |

Key facts: lsbdapp.mdb holds **no local data tables**: everything is a pass-through ODBC link (DSN `LSBDDB`) to SQL Server. ReportManager.accdb likewise holds no local tables: 20 ODBC links (DSN `REPORTS`) renamed `dbo_*`, 80 ad-hoc saved queries and 8 reports, no forms/modules/macros. **Neither file contains any non-select action query except one UPDATE** (`qryUpdNullPLLC`); there are no GROUP BY/aggregate queries and no union or pass-through queries. Business logic lives in VBA (20 standard modules + form/report code-behind) which writes through DAO recordsets, not action queries.

VBA source: **extractable** for lsbdapp.mdb (compressed VBA project found in `MSysAccessObjects`, decompressed with MS-OVBA). Only names, procedure lists and cross-references are reported here; code is not reproduced. For ReportManager.accdb there are no modules, and report code-behind (if any) sits in MSysAccessStorage, which was not parsed.

## 2. Linked ODBC tables -> SQL Server tables

Connect string (scrubbed): lsbdapp `DSN=LSBDDB;APP=Microsoft Office 2010;` (no UID/PWD stored in the link connect strings; credentials are held by the DSN or supplied at login); ReportManager `DSN=REPORTS;APP=Microsoft Office 2010;`. (Access Name -> SQL Server `ForeignName`.)

### 2a. lsbdapp.mdb (DSN LSBDDB)

| Access name | SQL Server table | Used by (forms/reports/queries/code, first few) |
|---|---|---|
| Cities | dbo.Cities | (queries/code only / none static) |
| Disciplinary | dbo.Disciplinary | query:qDisciplinaryFS, query:qDisciplinary |
| Education | dbo.Education | query:qEducation, query:qEducationFS |
| ElectionDistricts | dbo.ElectionDistricts | query:qryByKeyIndividualFS, query:qElectionDistricts, query:qryByKeyIndividualDisplay |
| IndividualAffiliation | dbo.IndividualAffiliation | query:qIndvAffiliations, query:qIndvAffiliationsFS, query:qIndvAffiliationsIndirect |
| Inspections | dbo.Inspections | query:qInspections |
| Office | dbo.Office | query:qLkupOffice |
| OfficeAffiliation | dbo.OfficeAffiliation | query:qOfficeAffiliations, query:qOfficeAffiliationsDentists, query:qOfficeAffiliationsFS |
| Permits | dbo.Permits | query:qOfficePermits, query:qOfficePermitsByDatesDen, query:qOfficePermitsByDatesDenList,… |
| PermitType | dbo.PermitType | query:qOfficePermitsByDatesDen, query:qOfficePermitsByDatesDenList, query:qPermitType, qu… |
| Professional | dbo.Professional | (queries/code only / none static) |
| tblASPermits | dbo.tblASPermits | query:qryAnesSedRenewal, query:qryASLabels, query:qryASList, query:qryASNotrenewed |
| tblChargeCategory | dbo.tblChargeCategory | (queries/code only / none static) |
| tblChargeInt | dbo.tblChargeInt | query:~sq_cfrmComplaint~sq_cint_chrg1, query:~sq_cfrmComplaint~sq_cint_chrg2, query:~sq_c… |
| tblClass | dbo.tblClass | form-ref:frmIndividual, form-ref:frmLabelsPanel, form-ref:frmMasterPanel |
| tblComplActions | dbo.tblComplActions | query:~sq_cfrmComplaint~sq_cAction, form:frmComplaint, form-ref:frmComplaint |
| tblComplaints | dbo.tblComplaints | query:qComplaintsFS, query:qryByKeyComplaint, query:qryByKeyComplaintSet, query:qryCompla… |
| tblComplClosure | dbo.tblComplClosure | query:~sq_cfrmComplaint~sq_cClosureTerms, form:frmComplaint, form-ref:frmComplaint |
| tblComplDecisions | dbo.tblComplDecisions | query:~sq_cfrmComplaint~sq_cDec_type, form:frmComplaint, form-ref:frmComplaint |
| tblComplHearings | dbo.tblComplHearings | query:~sq_cfrmComplaint~sq_cHearing, form:frmComplaint, form-ref:frmComplaint |
| tblComplProbation | dbo.tblComplProbation | query:~sq_cfrmComplaint~sq_cProbterms, form:frmComplaint, form-ref:frmComplaint |
| tblComplStatus | dbo.tblComplStatus | query:~sq_cfrmComplaint~sq_cStatus, query:~sq_cfrmComplaintSearch~sq_cStatus, form:frmCom… |
| tblCounties | dbo.tblCounties | query:qryCountyCombo |
| tblDates | dbo.tblDates | query:~sq_ffrmDateSettings, code:frmASPermit, code:frmComplaint, form:frmDateSettings |
| tblDenHyg | dbo.tblDenHyg | query:~sq_ffrmSelectIndividuals, query:qIndvAffiliations, query:qIndvAffiliationsFS, quer… |
| tblDisposition | dbo.tblDisposition | (queries/code only / none static) |
| tblExamsDent | dbo.tblExamsDent | query:qryExamHistoryDent |
| tblExamsHyg | dbo.tblExamsHyg | query:qryExamHistoryHyg |
| tblFees | dbo.tblFees | query:~sq_ffrmFeeSettings, form:frmFeeSettings, form-ref:frmFeeSettings, module:modSaveTr… |
| tblnactiveStatus | dbo.tblnactiveStatus | form-ref:frmIndividual |
| tblNumbers | dbo.tblNumbers | query:~sq_ffrmNumSettings, code:frmASPermit, code:frmComplaint, code:frmFirm |
| tblPAs | dbo.tblPAs | query:qryByIdPA, query:qryByKeyPA, query:qryChangeStatusPA, query:qryListPAs |
| tblPLLCs | dbo.tblPLLCs | query:qryByKeyPLLC, query:qOfficeAffiliationOptions, query:qOfficeAffiliations, query:qOf… |
| tblReportType | dbo.tblReportType | (queries/code only / none static) |
| tblRndAnesthesia | dbo.tblRndAnesthesia | query:qryRandAnes, code:frmRandomize |
| tblRndDentists | dbo.tblRndDentists | query:~sq_rrptAuditNoticeDen, query:~sq_rrptAuditNoticeIn, query:qryRandDentists, code:fr… |
| tblRndHygienists | dbo.tblRndHygienists | query:qryRandHyg, query:~sq_rrptAuditNoticeHyg, code:frmRandomize, report:rptAuditNoticeH… |
| tblRndSedation | dbo.tblRndSedation | query:qryRandSed, code:frmRandomize |
| tblSchools | dbo.tblSchools | query:~sq_ffrmListSchools, form:frmListSchools, form-ref:frmListSchools |
| tblSpecialties | dbo.tblSpecialties | form-ref:frmIndividual, form-ref:frmMasterPanel |
| tblStatus | dbo.tblStatus | query:~sq_cfrmChangeStatus~sq_cStatusFrom, query:~sq_cfrmChangeStatus~sq_cStatusTo, form-… |
| tblTransactions | dbo.tblTransactions | query:qryDeleteTrans, query:qryDenCardByNum, query:qryFindTrans, query:qryHygCardByNum |
| tblTransSplits | dbo.tblTransSplits | query:qryPeriodicSplits, module:modTransSplits |
| tblTransTypes | dbo.tblTransTypes | query:~sq_cfrmSplitsRegister~sq_cDescription, form:frmSplitsRegister, form-ref:frmSplitsR… |
| tblTypes | dbo.tblTypes | query:~sq_cfrmRenewalNotices~sq_cType, query:~sq_cfrmSplitsRegister~sq_cType, query:qryDe… |
| Users | dbo.Users | (queries/code only / none static) |
| Zipcodes | dbo.Zipcodes | (queries/code only / none static) |

### 2b. ReportManager.accdb (DSN REPORTS)

| Access name | SQL Server table |
|---|---|
| dbo_Cities | dbo.Cities |
| dbo_Education | dbo.Education |
| dbo_ElectionDistricts | dbo.ElectionDistricts |
| dbo_InspectionDetails | dbo.InspectionDetails |
| dbo_Inspections | dbo.Inspections |
| dbo_InspectionStatus | dbo.InspectionStatus |
| dbo_OfficeAffiliation | dbo.OfficeAffiliation |
| dbo_Parishes | dbo.Parishes |
| dbo_Permits | dbo.Permits |
| dbo_PermitType | dbo.PermitType |
| dbo_RenewalCertification | dbo.RenewalCertification |
| dbo_RenewalDetails | dbo.RenewalDetails |
| dbo_tblComplaints | dbo.tblComplaints |
| dbo_tblComplaints1 | dbo.tblComplaints |
| dbo_tblDenHyg | dbo.tblDenHyg |
| dbo_tblPLLCs | dbo.tblPLLCs |
| dbo_tblRndDentists | dbo.tblRndDentists |
| dbo_tblRndHygienists | dbo.tblRndHygienists |
| dbo_tblTransactions | dbo.tblTransactions |
| dbo_Zipcodes | dbo.Zipcodes |

SQL Server tables reached only via ReportManager (not linked in lsbdapp): InspectionDetails, InspectionStatus, Parishes, RenewalCertification, RenewalDetails. Note also `dbo_tblComplaints1` is a second link to `dbo.tblComplaints` (self-join / duplicate alias).

## 3. lsbdapp.mdb - saved queries by business function

139 user-visible saved queries (all type *select* unless marked). Columns: name | type | source tables/queries | key filter / parameters | purpose (guess) | referenced by.

### Affiliations & education (12)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qEducation | select | Education |  | Education records for licensee (subform / fact sheet). | form:frmIndividual, form-ref:frmIndividual, form:fsubEducat… |
| qEducationFS | select | Education |  | Education records for licensee (subform / fact sheet). | report:rptFactSheet, report-ref:rptFactSheet, report:rsubEd… |
| qIndvAffiliations | select | tblDenHyg, IndividualAffiliation |  | Affiliations between individuals and offices/firms. | form-ref:frmIndividual, form:fsubIndvAffiliations, form-ref… |
| qIndvAffiliationsFS | select | tblDenHyg, IndividualAffiliation |  | Affiliations between individuals and offices/firms. | report:rptFactSheet, report-ref:rptFactSheet, report:rsubIn… |
| qOfficeAffiliationOptions | select | tblPLLCs | WHERE tblPLLCs.ADDRESS1 Is Not Null And tblPLLCs.ADDRESS1<>"" | Affiliations between individuals and offices/firms. | form:frmEditOfficeAffiliations, form-ref:frmEditOfficeAffil… |
| qOfficeAffiliations | select | OfficeAffiliation, tblPLLCs |  | Affiliations between individuals and offices/firms. | form:frmIndividual, form-ref:frmIndividual, form:fsubOffice… |
| qOfficeAffiliationsDentists | select | tblDenHyg, OfficeAffiliation, tblPLLCs | WHERE tblPLLCs.Key=Forms!frmFirm!key | Affiliations between individuals and offices/firms. | form:frmOfficeAffiliationsDentists, form-ref:frmOfficeAffil… |
| qryExamHistoryDent | select | tblDenHyg, tblExamsDent | WHERE tblDenHyg.Key=Forms!frmIndividual!key | Exam history for licensees. | form:frmEducationDent, form-ref:frmEducationDent |
| qryExamHistoryHyg | select | tblDenHyg, tblExamsHyg | WHERE tblDenHyg.Key=Forms!frmIndividual!key | Exam history for licensees. | form:frmEducationHyg, form-ref:frmEducationHyg |
| qIndvAffiliationOptions | select | tblDenHyg | WHERE tblDenHyg.STATUS<>"DEC" | Affiliations between individuals and offices/firms. | form:frmEditIndvAffiliations, form-ref:frmEditIndvAffiliati… |
| qIndvAffiliationsIndirect | select | tblDenHyg, IndividualAffiliation |  | Affiliations between individuals and offices/firms. | form:frmIndividual, form-ref:frmIndividual, form:fsubIndvAf… |
| qOfficeAffiliationsFS | select | OfficeAffiliation, tblPLLCs |  | Affiliations between individuals and offices/firms. | report:rptFactSheet, report-ref:rptFactSheet, report:rsubOf… |

### Certificates, cards & print batches (26)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryDenCardBydate | select | tblDenHyg, qPersonalPermitsByDatesDenComb | WHERE tblDenHyg.Type="D" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by date range. | report:rptDenCardByDate, report-ref:rptDenCardByDate, repor… |
| qryDenCardByNum | select | tblDenHyg, tblTransactions | WHERE tblDenHyg.Type="D" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by transaction/certificate number range. | report:rptDenCardByNum, report-ref:rptDenCardByNum |
| qryHygCardBydate | select | tblDenHyg, qPersonalPermitsByDatesHygComb | WHERE tblDenHyg.Type="H" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by date range. | report:rptDenHygCardByNum, report-ref:rptDenHygCardByNum, r… |
| qryHygCardBydate-0 | select | tblDenHyg | WHERE tblDenHyg.Type="H" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by date range. | none |
| qryHygCardBydateSub | select | tblDenHyg, qPersonalPermitsByDatesHygComb | WHERE tblDenHyg.Type="H" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by date range. | none |
| qryHygCardByNum | select | tblDenHyg, tblTransactions | WHERE tblDenHyg.Type="H" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by transaction/certificate number range. | report:rptHygCardByNum, report-ref:rptHygCardByNum |
| qryRegCertByDateDen | select | tblDenHyg | WHERE tblDenHyg.Type="D" And tblDenHyg.STATUS="CUR" Or tblDenHyg.STATUS="PRB" Or tblDenHyg.STATUS="REP" And tblDenHy | Source for printing initial registration certificates by date range. | report:rptRegCertByDateDen, report-ref:rptRegCertByDateDen |
| qryRegCertByDatePA | select | tblPAs | WHERE tblPAs.STATUS="CUR" And tblPAs.DateSince Between forms!frmCertsByDate!from And forms!frmCertsByDate!to | Source for printing initial registration certificates by date range. | report:rptRegCertByDatePA, report-ref:rptRegCertByDatePA |
| qryRegCertByDatePLLC | select | tblPLLCs | WHERE tblPLLCs.STATUS="CUR" And tblPLLCs.DateSince Between forms!frmCertsByDate!from And forms!frmCertsByDate!to | Source for printing initial registration certificates by date range. | report:rptRegCertByDatePLLC, report-ref:rptRegCertByDatePLLC |
| qryRegCertByNumDen | select | tblDenHyg, tblTransactions | WHERE tblDenHyg.Type="D" And tblDenHyg.STATUS="CUR" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Clas | Source for printing initial registration certificates by transaction/certificate number range. | report:rptRegCertByNumDate, report-ref:rptRegCertByNumDate,… |
| qryRegCertByNumHyg | select | tblDenHyg, tblTransactions | WHERE tblDenHyg.Type="H" And tblDenHyg.STATUS="CUR" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Clas | Source for printing initial registration certificates by transaction/certificate number range. | report:rptRegCertByNumHyg, report-ref:rptRegCertByNumHyg |
| qryRegCertByNumPLLC | select | tblPLLCs, tblTransactions | WHERE tblTransactions.TransId Between forms!frmCertsByNum!from And forms!frmCertsByNum!to And tblTransactions.Print= | Source for printing initial registration certificates by transaction/certificate number range. | report:rptRegCertByNumPLLC, report-ref:rptRegCertByNumPLLC |
| qryRnwCertByDateAS | select | tblASPermits, tblDenHyg | WHERE tblASPermits.STATUS="CUR" And tblASPermits.DateRenew Between forms!frmCertsByDate!from And forms!frmCertsByDat | Source for printing renewal certificates by date range. | report:rptRnwCertByDateAS, report-ref:rptRnwCertByDateAS |
| qryRnwCertByDatePA | select | tblPAs | WHERE tblPAs.STATUS="CUR" And tblPAs.DateRenew Between forms!frmCertsByDate!from And forms!frmCertsByDate!to | Source for printing renewal certificates by date range. | report:rptRnwCertByDatePA, report-ref:rptRnwCertByDatePA |
| qryRnwCertByNumAS | select | tblASPermits, tblDenHyg, tblTransactions | WHERE tblASPermits.STATUS="CUR" And tblTransactions.TransId Between forms!frmCertsByNum!from And forms!frmCertsByNum | Source for printing renewal certificates by transaction/certificate number range. | report:rptRnwCertByNumAS, report-ref:rptRnwCertByNumAS |
| qryRnwCertByNumPA | select | tblPAs, tblTransactions | WHERE tblTransactions.TransId Between forms!frmCertsByNum!from And forms!frmCertsByNum!to And tblTransactions.Print= | Source for printing renewal certificates by transaction/certificate number range. | report:rptRnwCertByNumPA, report-ref:rptRnwCertByNumPA |
| qryRnwCertByNumPLLC | select | tblPLLCs, tblTransactions | WHERE tblTransactions.TransId Between forms!frmCertsByNum!from And forms!frmCertsByNum!to And tblTransactions.Print= | Source for printing renewal certificates by transaction/certificate number range. | report:rptRnwCertByNumPLLC, report-ref:rptRnwCertByNumPLLC |
| qrySetPrintMailDatesReg | select | tblTransactions | PARAM [LicType:], [From:], [To:]; WHERE tblTransactions.Description Like "Reg*" AND tblTransactions.Type=[LicType:] AND tblTransa… | Parameterised (licence type, from, to) selection of transactions to stamp as printed/mailed (initial registration). | module:modPrintMailDates |
| qrySetPrintMailDatesRegN | select | tblTransactions | PARAM [LicType:], [From:], [To:]; WHERE tblTransactions.Description Like "Reg*" AND tblTransactions.Type=[LicType:] AND tblTransa… | Parameterised (licence type, from, to) selection of transactions to stamp as printed/mailed (initial registration) - "N" variant likely the new/non-r… | module:modPrintMailDates |
| qrySetPrintMailDatesRnwN | select | tblTransactions | PARAM [LicType:], [From:], [To:]; WHERE tblTransactions.Description Like "Ren*" AND tblTransactions.Type=[LicType:] AND tblTransa… | Parameterised (licence type, from, to) selection of transactions to stamp as printed/mailed (renewal) - "N" variant likely the new/non-renewal flavou… | module:modPrintMailDates |
| qryDenCardBydate-0 | select | tblDenHyg | WHERE tblDenHyg.Type="D" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by date range. | none |
| qryHygCardBydateMaster | select | tblDenHyg | WHERE tblDenHyg.Type="H" And tblDenHyg.Class="L" Or tblDenHyg.Class="T" Or tblDenHyg.Class="C" And tblDenHyg.STATUS= | Source for printing wallet/licence cards by date range. | report:rptHygCardByDate, report-ref:rptHygCardByDate |
| qryRegCertByDateHyg | select | tblDenHyg | WHERE tblDenHyg.Type="H" And tblDenHyg.STATUS="CUR" And tblDenHyg.DateSince Between forms!frmCertsByDate!from And fo | Source for printing initial registration certificates by date range. | report:rptRegCertByDateHyg, report-ref:rptRegCertByDateHyg |
| qryRegCertByNumPA | select | tblPAs, tblTransactions | WHERE tblTransactions.TransId Between forms!frmCertsByNum!from And forms!frmCertsByNum!to And tblTransactions.Print= | Source for printing initial registration certificates by transaction/certificate number range. | report:rptRegCertByNumPA, report-ref:rptRegCertByNumPA |
| qryRnwCertByDatePLLC | select | tblPLLCs | WHERE tblPLLCs.STATUS="CUR" And tblPLLCs.DateRenew Between forms!frmCertsByDate!from And forms!frmCertsByDate!to | Source for printing renewal certificates by date range. | report:rptRnwCertByDatePLLC, report-ref:rptRnwCertByDatePLLC |
| qrySetPrintMailDatesRnw | select | tblTransactions | PARAM [LicType:], [From:], [To:]; WHERE tblTransactions.Description Like "Ren*" AND tblTransactions.Type=[LicType:] AND tblTransa… | Parameterised (licence type, from, to) selection of transactions to stamp as printed/mailed (renewal). | module:modPrintMailDates |

### Complaints & discipline (8)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qComplaintsFS | select | tblComplaints |  | Complaint record source. | report:rptFactSheet, report-ref:rptFactSheet, report:rsubCo… |
| qDisciplinaryFS | select | Disciplinary |  | Disciplinary actions listing (subform / fact sheet). | report:rptFactSheet, report-ref:rptFactSheet, report:rsubDi… |
| qryComplaintReports | select | tblDenHyg, tblComplaints | WHERE tblComplaints.STATUS Like Forms!frmComplaintReports!status And tblComplaints.LICENSEID Like Forms!frmComplaint | Complaint report data. | none |
| qryComplChargeCodes | select | tblChargeInt | WHERE tblChargeInt.ID=[Enter Id:] | Complaint charge code lookup for the complaint form. | code:frmComplaint |
| qryHistoryComplaints | select | tblComplaints | WHERE tblComplaints.LICENSEID Like Forms!frmIndividual!LicenseId And tblComplaints.LICTYPE=Forms!frmIndividual!Type | Historical complaints for a respondent. | form:frmHistoryComplaints, form-ref:frmHistoryComplaints |
| qryListComplaints | select | tblDenHyg, tblComplaints | WHERE tblComplaints.STATUS Like Forms!frmComplaintSearch!status And tblComplaints.LICENSEID Like Forms!frmComplaintS | Complaint list for browsing/searching. | form:frmListComplaints, form-ref:frmListComplaints |
| qryUpdComplaint | select | tblDenHyg | WHERE tblDenHyg.LICENSEID=[Enter Id:] AND tblDenHyg.Type=[Enter Type:] | Sync complaint info back to licensee record (select form; used by save routine). | none |
| qDisciplinary | select | Disciplinary |  | Disciplinary actions listing (subform / fact sheet). | form:frmIndividual, form-ref:frmIndividual, form:fsubDiscip… |

### Financial / transactions (7)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryFindTrans | select | tblTransactions | PARAM [Enter Id:]; WHERE tblTransactions.TransId=Val[Enter Id:] | Find a transaction by id (parameter prompt). | module:modDisplayTransactions |
| qryPeriodicRegiser | select | tblTransactions | WHERE tblTransactions.DateTrans Between Forms!frmPeriodicRegister!From And Forms!frmPeriodicRegister!To | Periodic transaction (receipts) register for a date range. | report:rptPeriodicRegister, report-ref:rptPeriodicRegister |
| qryTransHist | select | tblTransactions | WHERE tblTransactions.Licenseid=Forms!frmIndividual!LicenseId | Transaction history listing (all types). | none |
| qryTransHistAS | select | tblTransactions | WHERE tblTransactions.Licenseid=Forms!frmASPermit!LicenseId | Transaction history listing (all types). | form:frmTransHistAS, form-ref:frmTransHistAS |
| qryTransHistFirm | select | tblTransactions | WHERE tblTransactions.Licenseid=Forms!frmFirm!LicenseId | Transaction history listing (all types). | form:frmTransHistFirm, form-ref:frmTransHistFirm |
| qryTransHistIN | select | tblTransactions | WHERE tblTransactions.Licenseid=Forms!frmIndividual!LicenseId And tblTransactions.Type=Forms!frmIndividual!Type | Transaction history listing (all types). | form:frmTransHistIN, form-ref:frmTransHistIN |
| qryPeriodicSplits | select | tblTransSplits | WHERE tblTransSplits.Description Like Forms!frmsplitsRegister!description And tblTransSplits.Type=Forms!frmsplitsReg | Periodic register of fee splits (revenue allocation) over a period. | report:rptPeriodicSplits, report-ref:rptPeriodicSplits |

### Firm records (PA / PLLC) (5)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qOfficeLocations | select | tblPLLCs | WHERE tblPLLCs.ADDRESS1 Is Not Null And tblPLLCs.ADDRESS1<>"" | Office/PLLC locations list (name and address) for lookups. | form-ref:frmEditOfficePermits |
| qryListPAs | select | tblPAs | WHERE tblPAs.LICENSEID Like Forms!frmMasterPanel!LicenseId And tblPAs.ESTNAME Like Forms!frmMasterPanel!Name And tbl | Firm (PA/PLLC) listing or lookup. | form:frmListPAs, form-ref:frmListPAs |
| qryListPLLCs | select | tblPLLCs | WHERE tblPLLCs.LICENSEID Like Forms!frmMasterPanel!LicenseId And tblPLLCs.STATUS Like Forms!frmMasterPanel!status An | Firm (PA/PLLC) listing or lookup. | form:frmListPLLCs, form-ref:frmListPLLCs |
| qryUpdNullPLLC | update | tblPLLCs | WHERE tblPLLCs.Type Is Null | UPDATE query: default null PLLC Type to "LL" (data clean-up). | none |
| qryPA | select | tblPAs | WHERE tblPAs.STATUS="exp" AND tblPAs.DateUntil>#5/30/2007# And tblPAs.DateUntil<#6/22/2007# | Firm (PA/PLLC) listing or lookup. | none |

### Inspections (1)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qInspections | select | Inspections | WHERE Inspections.OFFICE_ID=Forms!frmFirm!Key | Office inspection records (inspection form). | form:frmInspections, form-ref:frmInspections |

### Late renewals / past due (late fees) (5)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| QryPALate | select | tblPAs | WHERE tblPAs.STATUS="EXP" AND tblPAs.RenewMnth="09" | Late-renewal / past-due selection (feeds late notices and late-fee assessment). | report:RptRenewalNoticePALate, report-ref:RptRenewalNoticeP… |
| qryPLLClate | select | tblPLLCs | WHERE tblPLLCs.RenewMnth="10" AND tblPLLCs.STATUS="exp" AND tblPLLCs.DateUntil>#1/1/2007# | Late-renewal / past-due selection (feeds late notices and late-fee assessment). | none |
| qryRenewalNoticePALate | select | tblPAs | WHERE tblPAs.RenewMnth="10" AND tblPAs.STATUS="EXP" | Late-renewal / past-due selection (feeds late notices and late-fee assessment). | none |
| qryPaPastDue | select | tblPAs | WHERE tblPAs.STATUS="expired" AND tblPAs.RenewMnth="06" | Late-renewal / past-due selection (feeds late notices and late-fee assessment). | none |
| qryRenewalDhlate | select | tblDenHyg | WHERE tblDenHyg.Type="H" AND tblDenHyg.Class="L" Or tblDenHyg.Class="T" AND tblDenHyg.STATUS="EXP" AND tblDenHyg.Dat | Late-renewal / past-due selection (feeds late notices and late-fee assessment). | none |

### Licensee records (1)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryIndividualList | select | tblDenHyg | WHERE tblDenHyg.Type Like Forms!frmMasterPanel!type & "*" And tblDenHyg.LASTName Like Forms!frmMasterPanel!lname And | Browsable list of individual licensees. | none |

### Lookups / combo-box sources (9)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qLkupOffice | select | Office | WHERE Office.OfficeName Is Not Null And Office.OfficeName<>"" | Drop-down source: Office. | none |
| qPermitType | select | PermitType |  | Drop-down source: PermitType. | form:frmEditOfficePermits, form-ref:frmEditOfficePermits, f… |
| qryDenTypes | select | tblTypes | WHERE tblTypes.Type="D" | Drop-down source: DenTypes. | form-ref:frmIndividual |
| qryEDDATypes | select | tblTypes | WHERE tblTypes.Type="E" | Drop-down source: EDDATypes. | module:modDisplayIndividual |
| qryHygTypes | select | tblTypes | WHERE tblTypes.Type="H" | Drop-down source: HygTypes. | module:modDisplayIndividual |
| qElectionDistricts | select | ElectionDistricts |  | Drop-down source: ElectionDistricts. | none |
| qryASTypes | select | tblTypes | WHERE tblTypes.Type="A" Or tblTypes.Type="S" | Drop-down source: ASTypes. | form-ref:frmASPermit |
| qryCountyCombo | select | tblCounties |  | Drop-down source: CountyCombo. | form:frmASPermit, form-ref:frmASPermit, form:frmFirm |
| qryFirmTypes | select | tblTypes | WHERE tblTypes.Type="PA" Or tblTypes.Type="LL" | Drop-down source: FirmTypes. | none |

### Mailing labels / exports (6)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryASLabels | select | tblASPermits, tblDenHyg | WHERE tblDenHyg.FIRSTName Like Forms!frmLabelsPanel!FNAME And tblDenHyg.LASTName Like Forms!frmLabelsPanel!LNAME And | Mailing-label source. | none |
| qryDiskUNCDen | select | tblDenHyg | WHERE tblDenHyg.Type="D" AND tblDenHyg.Class="L" | Export source for the "create disk" file (UNC/disk export). | code:frmCreateDisk |
| qryPALabels | select | tblPAs | WHERE tblPAs.ESTNAME Like Forms!frmLabelsPanel!NAME And tblPAs.CITY Like Forms!frmLabelsPanel!city And tblPAs.STATE  | Mailing-label source. | report:rptPALabels, report-ref:rptPALabels |
| qryPLLCLabels | select | tblPLLCs | WHERE tblPLLCs.ESTNAME Like Forms!frmLabelsPanel!NAME And tblPLLCs.CITY Like Forms!frmLabelsPanel!city And tblPLLCs. | Mailing-label source. | report:rptPLLCLabels, report-ref:rptPLLCLabels |
| qryDiskUNCHyg | select | tblDenHyg | WHERE tblDenHyg.Type="H" AND tblDenHyg.Class="L" | Export source for the "create disk" file (UNC/disk export). | code:frmCreateDisk |
| qryINLabels | select | tblDenHyg | WHERE tblDenHyg.FIRSTName Like Forms!frmLabelsPanel!FNAME And tblDenHyg.LASTName Like Forms!frmLabelsPanel!LNAME And | Mailing-label source. | report:rptCheshireIN, report-ref:rptCheshireIN |

### Permits (personal / office / anesthesia-sedation) (16)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qOfficePermits | select | tblDenHyg, Permits, tblPLLCs | WHERE Permits.Office_ID>0 | Permit listing / subform source. | form:frmIndividual, form-ref:frmIndividual, form:fsubOffice… |
| qOfficePermitsByDatesDen | select | tblDenHyg, Permits, PermitType, tblPLLCs | WHERE Permits.Office_ID>0 And tblDenHyg.Type="D" And tblDenHyg.STATUS="ACT" Or tblDenHyg.STATUS="PRB" Or tblDenHyg.S | Permits issued/expiring in a date range for printing permit certificates. | report:rptDenOffPermitsByDate, report-ref:rptDenOffPermitsB… |
| qOfficePermitsByDatesDenList | select | tblDenHyg, Permits, PermitType, tblPLLCs | WHERE Permits.PermitType="Adult - Oral" And Permits.Office_ID>0 And tblDenHyg.Type="D" And tblDenHyg.STATUS="ACT" Or | Permits issued/expiring in a date range for printing permit certificates. | none |
| qOfficePermitsDentists | select | tblDenHyg, Permits, tblPLLCs | WHERE Permits.Office_ID>0 And tblPLLCs.Key=Forms!frmFirm!key | Permit listing / subform source. | form:frmOfficePermitsDentists, form-ref:frmOfficePermitsDen… |
| qOfficePermitsFS | select | tblDenHyg, Permits, tblPLLCs | WHERE Permits.Office_ID>0 | Permit listing / subform source. | report:rptFactSheet, report-ref:rptFactSheet, report:rsubOf… |
| qPersonalPermits | select | tblDenHyg, Permits | WHERE Permits.Office_ID Is Null | Permit listing / subform source. | form:frmIndividual, form-ref:frmIndividual, form:fsubPerson… |
| qPersonalPermitsByDatesDen0 | select | tblDenHyg, Permits, PermitType | WHERE Permits.PermitType="General" And Permits.PermitType<>"Parenteral" And Permits.PermitType<>"Pediatric" And Perm | Permits issued/expiring in a date range for printing permit certificates. | none |
| qPersonalPermitsByDatesDenComb | select | Permits, PermitType | WHERE Permits.Office_ID Is Null AND Permits.PermitLevel="P" | Permits issued/expiring in a date range for printing permit certificates. | only other queries |
| qPersonalPermitsByDatesDenList | select | tblDenHyg, Permits, PermitType | WHERE Permits.Office_ID Is Null And tblDenHyg.Type="D" And tblDenHyg.STATUS="ACT" Or tblDenHyg.STATUS="PRB" Or tblDe | Permits issued/expiring in a date range for printing permit certificates. | none |
| qPersonalPermitsByDatesHyg | select | tblDenHyg, Permits, PermitType | WHERE Permits.PermitType="Local" And Permits.Office_ID Is Null And tblDenHyg.Type="H" And tblDenHyg.STATUS="ACT" Or  | Permits issued/expiring in a date range for printing permit certificates. | report:rptHygPerPermitsByDate, report-ref:rptHygPerPermitsB… |
| qPersonalPermitsFS | select | tblDenHyg, Permits | WHERE Permits.Office_ID Is Null | Permit listing / subform source. | report:rptFactSheet, report-ref:rptFactSheet, report:rsubPe… |
| qryASList | select | tblASPermits, tblDenHyg | WHERE tblASPermits.Type Like Forms!frmMasterPanel!type And tblDenHyg.LASTName Like Forms!frmMasterPanel!lname And tb | Anesthesia/sedation permit list. | none |
| qrysedevaluators | select | tblASPermits, tblDenHyg | WHERE tblASPermits.LicenseId="160179" Or tblASPermits.LicenseId="160103" Or tblASPermits.LicenseId="160256" Or tblAS | List of sedation evaluators among anesthesia/sedation permit holders. | none |
| qOfficePermitsByDatesDen00 | select | tblDenHyg, Permits, tblPLLCs | WHERE Permits.PermitType="General" And Permits.PermitType<>"Parenteral" And Permits.PermitType<>"Pediatric" And Perm | Permits issued/expiring in a date range for printing permit certificates. | none |
| qPersonalPermitsByDatesDen | select | tblDenHyg, Permits, PermitType | WHERE Permits.Office_ID Is Null And tblDenHyg.Type="D" And tblDenHyg.STATUS="ACT" Or tblDenHyg.STATUS="PRB" Or tblDe | Permits issued/expiring in a date range for printing permit certificates. | report:rptDenPerPermitsByDate, report-ref:rptDenPerPermitsB… |
| qPersonalPermitsByDatesHygComb | select | Permits, PermitType | WHERE Permits.PermitType="Local" Or Permits.PermitType="Nitrous" AND Permits.Office_ID Is Null | Permits issued/expiring in a date range for printing permit certificates. | report:rptHygCardByDate, report-ref:rptHygCardByDate, repor… |

### Random audit sampling (4)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryRandAnes | select | tblDenHyg, tblRndAnesthesia | WHERE tblDenHyg.AddrType="b" | Joins the random-sample table to licensee records to produce the audit list. | report:rptAuditNoticeAnes, report-ref:rptAuditNoticeAnes |
| qryRandHyg | select | tblDenHyg, tblRndHygienists |  | Joins the random-sample table to licensee records to produce the audit list. | none |
| qryRandSed | select | tblDenHyg, tblRndSedation |  | Joins the random-sample table to licensee records to produce the audit list. | report:rptAuditNoticeSed, report-ref:rptAuditNoticeSed |
| qryRandDentists | select | tblRndDentists, tblDenHyg | WHERE tblDenHyg.Type="D" AND tblDenHyg.Class="L" Or tblDenHyg.Class="C" Or tblDenHyg.Class="T" | Joins the random-sample table to licensee records to produce the audit list. | none |

### Record maintenance (CRUD helpers) (26)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryByKeyPLLC | select | tblPLLCs | PARAM [Enter Id:]; WHERE tblPLLCs.Key=Val[Enter Id:] | Fetch a single PLLC by key/id (parameter prompt) for the detail forms. | module:modDisplayFirms, module:modSaveFirm |
| qryByIdASName | select | tblASPermits, tblDenHyg | PARAM [Enter Id:]; WHERE tblASPermits.Key=Val[Enter Id:] | Fetch a single ASName by key/id (parameter prompt) for the detail forms. | none |
| qryByIdASPermit | select | tblASPermits | PARAM [Enter Id:]; WHERE tblASPermits.LicenseId=[Enter Id:] | Fetch a single ASPermit by key/id (parameter prompt) for the detail forms. | module:modBatchRenewals |
| qryByIdIndividual | select | tblDenHyg | WHERE tblDenHyg.LICENSEID=[Enter Id:] | Fetch a single Individual by key/id (parameter prompt) for the detail forms. | code:frmASPermit, code:frmComplaint, module:modBatchRenewals |
| qryByIdPA | select | tblPAs | PARAM [Enter Id:]; WHERE tblPAs.LICENSEID=[Enter Id:] | Fetch a single PA by key/id (parameter prompt) for the detail forms. | module:modBatchRenewals |
| qryByIdPLLC | select | tblPLLCs | PARAM [Enter Id:]; WHERE tblPLLCs.LICENSEID=[Enter Id:] | Fetch a single PLLC by key/id (parameter prompt) for the detail forms. | module:modBatchRenewals |
| qryByKeyASGet | select | tblASPermits, tblDenHyg | PARAM [Enter Id:]; WHERE tblASPermits.Key=Val[Enter Id:] | Fetch a single ASGet by key/id (parameter prompt) for the detail forms. | module:modDisplayASPermits |
| qryByKeyComplaint | select | tblDenHyg, tblComplaints | PARAM [Enter Id:]; WHERE tblComplaints.Key=Val[Enter Id:] | Fetch a single Complaint by key/id (parameter prompt) for the detail forms. | module:modDisplayComplaint |
| qryByKeyComplaintSet | select | tblComplaints | PARAM [Enter Id:]; WHERE tblComplaints.Key=Val[Enter Id:] | Key-parameter recordset used by the save routine for Complaint (insert/update target). | module:modSaveComplaint |
| qryByKeyIndividual | select | tblDenHyg | PARAM [Enter Id:]; WHERE tblDenHyg.Key=Val[Enter Id:] | Fetch a single Individual by key/id (parameter prompt) for the detail forms. | module:modSaveIndividual |
| qryByKeyIndividualFS | select | tblDenHyg, ElectionDistricts | WHERE tblDenHyg.Key=ValForms!frmIndividual!Key | Fetch a single IndividualFS by key/id (parameter prompt) for the detail forms / fact sheet. | report:rptFactSheet, report-ref:rptFactSheet |
| qryByKeyPA | select | tblPAs | PARAM [Enter Id:]; WHERE tblPAs.Key=Val[Enter Id:] | Fetch a single PA by key/id (parameter prompt) for the detail forms. | module:modDisplayFirms, module:modSaveFirm |
| qryChangeStatusAS | select | tblASPermits | WHERE tblASPermits.Type=[type:] AND tblASPermits.STATUS=[status:] AND tblASPermits.DateUntil=[dateuntil:] | Recordset used by Change Status form to bulk-change licence status for AS. | code:frmChangeStatus |
| qryChangeStatusPA | select | tblPAs | WHERE tblPAs.Type=[type:] AND tblPAs.STATUS=[status:] AND tblPAs.RenewMnth=[Month:] | Recordset used by Change Status form to bulk-change licence status for PA. | code:frmChangeStatus |
| qryChangeStatusPLLC | select | tblPLLCs | WHERE tblPLLCs.Type=[Type:] AND tblPLLCs.STATUS=[STATUS:] AND tblPLLCs.RenewMnth=[Month:] | Recordset used by Change Status form to bulk-change licence status for PLLC. | code:frmChangeStatus |
| qryDeleteASPermit | select | tblASPermits | PARAM [Enter Id:]; WHERE tblASPermits.Key=Val[Enter Id:] | Key-parameter lookup used by the delete routine for ASPermit. | code:frmASPermit |
| qryDeleteComplaint | select | tblComplaints | PARAM [Enter Id:]; WHERE tblComplaints.Key=Val[Enter Id:] | Key-parameter lookup used by the delete routine for Complaint. | code:frmComplaint |
| qryDeleteIndividual | select | tblDenHyg | PARAM [Enter Id:]; WHERE tblDenHyg.Key=Val[Enter Id:] | Key-parameter lookup used by the delete routine for Individual. | code:frmIndividual |
| qryDeletePLLC | select | tblPLLCs | PARAM [Enter Id:]; WHERE tblPLLCs.Key=Val[Enter Id:] | Key-parameter lookup used by the delete routine for PLLC. | code:frmFirm |
| qryDeleteTrans | select | tblTransactions | PARAM [Enter Id:]; WHERE tblTransactions.ID=Val[Enter Id:] | Key-parameter lookup used by the delete routine for Trans. | code:frmEditTransaction |
| qryByIdIndividualDH | select | tblDenHyg | WHERE tblDenHyg.LICENSEID=[Enter Id:] AND tblDenHyg.Type=[Enter Type:] | Fetch a single IndividualDH by key/id (parameter prompt) for the detail forms. | module:modDisplayLists, module:modSaveComplaint |
| qryByKeyASSet | select | tblASPermits | PARAM [Enter Id:]; WHERE tblASPermits.Key=Val[Enter Id:] | Key-parameter recordset used by the save routine for AS (insert/update target). | module:modSaveASPermit |
| qryByKeyIndividualDisplay | select | tblDenHyg, ElectionDistricts | PARAM [Enter Id:]; WHERE tblDenHyg.Key=Val[Enter Id:] | Fetch a single IndividualDisplay by key/id (parameter prompt) for the detail forms. | module:modDisplayIndividual |
| qryChangeStatusIN | select | tblDenHyg | WHERE tblDenHyg.Type=[Type:] AND tblDenHyg.Class="L" AND tblDenHyg.STATUS=[Status:] AND tblDenHyg.DateUntil=[DateUnt | Recordset used by Change Status form to bulk-change licence status for IN. | code:frmChangeStatus |
| qryDeletePA | select | tblPAs | PARAM [Enter Id:]; WHERE tblPAs.Key=Val[Enter Id:] | Key-parameter lookup used by the delete routine for PA. | code:frmFirm |
| qrySaveTrans | select | tblTransactions | PARAM [Enter Id:]; WHERE tblTransactions.ID=Val[Enter Id:] | Key-parameter recordset used by the save routine for SaveTrans (insert/update target). | module:modSaveTransactions |

### Renewals (6)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryPArenewalnotice | select | tblPAs | WHERE tblPAs.STATUS="Exp" AND tblPAs.RenewMnth="04" | Renewal notice data source (PA firm). | none |
| qryRenewalNoticeAS | select | tblASPermits, tblDenHyg | WHERE tblASPermits.Type=forms!frmrenewalnotices!type And tblASPermits.STATUS<>"TMP" And tblASPermits.STATUS<>"EXP" A | Renewal notice data source. | none |
| qryRenewalNoticeAS2 | select | tblASPermits, tblDenHyg | WHERE tblASPermits.Type="S" AND tblASPermits.STATUS<>"TMP" And tblASPermits.STATUS<>"EXP" And tblASPermits.STATUS<>" | Renewal notice data source. | none |
| qryRenewalNoticeIN | select | tblDenHyg | WHERE tblDenHyg.Type=forms!frmrenewalnotices!type And tblDenHyg.Class="L" Or tblDenHyg.Class="T" And tblDenHyg.STATU | Renewal notice data source. | none |
| qryRenewalNoticePA | select | tblPAs | WHERE tblPAs.RenewMnth=forms!frmrenewalnotices!renewmnth And tblPAs.STATUS="EXP" | Renewal notice data source. | report:rptRenewalNoticePA, report-ref:rptRenewalNoticePA |
| qryRenewalNoticePLLC | select | tblPLLCs | WHERE tblPLLCs.STATUS="exp" And tblPLLCs.RenewMnth=forms!frmrenewalnotices!renewmnth | Renewal notice data source. | report:rptRenewalNoticePLLC, report-ref:rptRenewalNoticePLL… |

### Renewals & late fees / past due (7)

| Query | Type | Sources | Filter / params | Purpose (guess) | Static refs |
|---|---|---|---|---|---|
| qryAnesSedRenewal | select | tblASPermits, tblDenHyg | WHERE tblASPermits.Type="s" Or tblASPermits.Type="a" AND tblASPermits.STATUS="cur" | Anesthesia/sedation permits due for renewal. | none |
| qryASNotrenewed | select | tblASPermits, tblDenHyg | WHERE tblASPermits.DateUntil=#3/31/2008# AND tblASPermits.Type="s" Or tblASPermits.Type="a" AND tblASPermits.STATUS= | Anesthesia/sedation permits not yet renewed. | none |
| qryPAreg | select | tblPAs | WHERE tblPAs.STATUS="CUR" | Registered firm list for renewal processing. | none |
| qryPLLCreg | select | tblPLLCs | WHERE tblPLLCs.STATUS="CUR" | Registered firm list for renewal processing. | none |
| qryRenewalDdsIN | select | tblDenHyg | WHERE tblDenHyg.LICENSEID="107344" AND tblDenHyg.Type="D" AND tblDenHyg.Class="L" Or tblDenHyg.Class="I" AND tblDenH | Dentists/hygienists due to renew or expired (renewal mailing/processing list). | none |
| qryRenewalDHIN | select | tblDenHyg | WHERE tblDenHyg.Type="H" AND tblDenHyg.Class="L" Or tblDenHyg.Class="T" AND tblDenHyg.STATUS="CUR" Or tblDenHyg.STAT | Dentists/hygienists due to renew or expired (renewal mailing/processing list). | none |
| qryRnwExpDDS&DH | select | tblDenHyg | WHERE tblDenHyg.STATUS="EXP" | Dentists/hygienists due to renew or expired (renewal mailing/processing list). | none |

## 4. ReportManager.accdb - saved queries by business function

80 user-visible saved queries (all type *select* unless marked). Columns: name | type | source tables/queries | key filter / parameters | purpose (guess).

### Complaints & discipline (6)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Complaint information DENTAL | select | dbo_tblComplaints, Complaints Electoral District Mailing List | WHERE dbo_tblComplaints.LICTYPE="D" AND dbo_tblComplaints.CLOSE_DT>#6/30/2021# Or dbo_tblComplaints.CLOSE_DT Is Null | Complaint information / election-district mailing list for board members. |
| Complaint information HYGIENE | select | dbo_tblComplaints, dbo_tblDenHyg | WHERE dbo_tblComplaints.LICTYPE="H" AND dbo_tblComplaints.LOG_DT>#6/30/2015# AND dbo_tblDenHyg.Type="H" | Complaint information / election-district mailing list for board members. |
| Complaints Electoral District Mailing List | select | dbo_tblDenHyg, dbo_ElectionDistricts | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.LICENSEID<>"0000" | Complaint information / election-district mailing list for board members. |
| DISTRICT INFO DENTAL | select | dbo_tblDenHyg, dbo_ElectionDistricts | WHERE dbo_tblDenHyg.Type="D" | Complaint information / election-district mailing list for board members. |
| Electoral District Mailing List | select | dbo_tblDenHyg, dbo_ElectionDistricts | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.STATUS="act" Or dbo_tblDenHyg.STA | Complaint information / election-district mailing list for board members. |
| Probation | select | dbo_tblDenHyg, dbo_ElectionDistricts | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="PRB" | Licensees on probation with district info. |

### Financial / renewal counts (9)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| PAPER Renewal Totals | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#9/30/2017# AND dbo_tblTransactions.RefNum<>"ONLINE" AND dbo_tblDenHyg.STATUS="A | Paper (mail-in) renewals count/transactions. |
| Paper Renewal Transactions ONLY | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#9/30/2016# AND dbo_tblTransactions.RefNum<>"ONLINE" AND dbo_tblDenHyg.STATUS="A | Paper (mail-in) renewals count/transactions. |
| PHF initial license | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblTransactions.RefNum<>"ONLINE" AND dbo_tblTransacti | Initial-license transactions (PHF) for a period. |
| Renewal Totals ALL | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#6/30/2022# AND dbo_tblDenHyg.DateRenew>#6/30/2022# And dbo_tblDenHyg.DateRenew< | Renewal transaction totals for reporting. |
| Renewal Totals--DENTAL | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#6/30/2019# And dbo_tblTransactions.DateTrans<#7/1/2020# AND dbo_tblDenHyg.DateR | Renewal transaction totals for reporting. |
| Renewal Totals--HYGIENE | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#6/30/2019# AND dbo_tblTransactions.Fee=100 Or dbo_tblTransactions.Fee=200 AND d | Renewal transaction totals for reporting. |
| Renewal Transactions | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblTransactions.W | Renewal transaction totals for reporting. |
| Transactions | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#9/1/2017# | Transactions listing joined to licensees. |
| ONLINE Renewal Totals | select | dbo_tblTransactions, dbo_tblDenHyg | WHERE dbo_tblTransactions.DateTrans>#6/30/2019# AND dbo_tblTransactions.RefNum="ONLINE" AND dbo_tblDenHyg.DateUntil= | Online renewal totals. |

### Inspections (15)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Copy Of Office INSPECTIONS FINAL | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblDenHyg.Class=" | Final inspection result per office. |
| Copy Of Office Inspections NOT REQUIRED | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_Inspections.Inspe | Offices needing or not needing inspection this round. |
| Inspections | select | dbo_Inspections | WHERE dbo_Inspections.InspectionDate>#6/30/2015# | Office inspection status reporting. |
| Office Inspections ATTEMPTED THIS ROUND | select | dbo_Inspections, dbo_tblPLLCs | WHERE dbo_Inspections.InspectionDate>#8/1/2015# AND dbo_tblPLLCs.STATE="LA" | Offices where an inspection was attempted this round. |
| Office Inspections CLOSED--REDO | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblPLLCs.Key=3810 | Inspections closed / to be redone. |
| Office INSPECTIONS FINAL | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblPLLCs.Notes No | Final inspection result per office. |
| Office Inspections FOLLOW UP | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_Inspections.STATU | Inspections needing follow-up. |
| Office Inspections INCOMPLETE | select | dbo_Inspections | WHERE dbo_Inspections.InspectionDate>#8/1/2015# AND dbo_Inspections.STATUS<>"ACTIVE" Or dbo_Inspections.STATUS="FOLL | Incomplete inspections. |
| Office Inspections NOT ATTEMPTED THIS ROUND | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblPLLCs.Notes No | Offices needing or not needing inspection this round. |
| Office Inspections NOT REQUIRED | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_Inspections.Inspe | Offices needing or not needing inspection this round. |
| Office Inspections--ALL INFORMATION | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblPLLCs.Notes No | Office inspection status reporting. |
| Office Permits CORRECT DO NOT EDIT--FOR INSPECTIONS | select | dbo_Permits, dbo_tblDenHyg, dbo_tblPLLCs | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_Permits.PermitLeve | Base query ("DO NOT EDIT") feeding the other inspection queries: office permits joined to offices and dentists. |
| Offices NOT INSPECTED THIS ROUND | select | Office INSPECTIONS FINAL, dbo_Inspections |  | Offices needing or not needing inspection this round. |
| Office Inspections COMPLETED OFFICES ONLY--NO NAME | select | dbo_tblPLLCs, dbo_Inspections | WHERE dbo_tblPLLCs.STATE="LA" AND dbo_Inspections.STATUS="ACTIVE" Or dbo_Inspections.STATUS="FOLLOW UP" AND dbo_Insp | Office inspection status reporting. |
| Office Inspections--ALL INFORMATION FOR NUMBERS | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_Inspections.InspectionDate>#7/31/2018# Or dbo | Office inspection status reporting. |

### Licensee status lists (3)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Restricted | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.DateSince>#1/1/2020# And dbo_tblD | Licensees with status "Restricted". |
| Retired | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="RET" AND dbo_tblDenHyg.DateUntil=#1 | Licensees with status "Retired". |
| Revocations | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="REV" AND dbo_tblDenHyg.DateUntil=#1 | Licensees with status "Revocations". |

### Licensees & applicants (5)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Applicants | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Class="A" AND dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.DateUpdated>#3/1/2025# | Applicants list. |
| EducationInfo | select | dbo_tblDenHyg, dbo_Education | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.SEX="F" | Licensees with education info. |
| LA OMFS Education Info | select | dbo_tblDenHyg, dbo_Education | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.STATE="L | Licensees with education info. |
| New Licensees WITH EDUCATION | select | dbo_tblDenHyg, dbo_Education | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.DateSince>#12/31/2017# AND dbo_tb | Licensees with education info. |
| New licensees | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" Or dbo_tblDenHyg.Type="E" AND dbo_tblDenHyg.STATUS="ACT" AND  | Newly licensed practitioners. |

### Lookups / ad-hoc licensee queries (10)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Class | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATE="LA" AND dbo_tblDenHyg.STAT | Ad-hoc licensee lookup (Class). |
| Class--KEY | select | dbo_tblDenHyg |  | Ad-hoc licensee lookup (Class--KEY). |
| Password | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.LICENSEID="2367" | Ad-hoc licensee lookup (Password). |
| EDDA | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Type="E" AND dbo_tblDenHyg.DateSince>#6/30/2020# And dbo_tbl | Ad-hoc licensee lookup (EDDA). |
| LOOKUP-CERTIFICATIONQA | select | dbo_RenewalCertification, dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID="3709" Or dbo_tblDenHyg.LICENSEID="4085" Or dbo_tblDenHyg.LICENSEID="5243" Or dbo_tblD | Ad-hoc licensee lookup (LOOKUP-CERTIFICATIONQA). |
| SampleDenHygQuery | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.DateUnti | Ad-hoc licensee lookup (SampleDenHygQuery). |
| AudtiLookup | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.DateUnti | Ad-hoc licensee lookup (AudtiLookup). |
| LookUpLostFolks | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.LICENSEID=[Enter Id:] AND dbo_tblDenHyg.STA | Ad-hoc licensee lookup (LookUpLostFolks). |
| All licensees | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.STATUS= | Ad-hoc licensee lookup (All licensees). |
| Miscellaneous Query | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.DateUnti | Ad-hoc licensee lookup (Miscellaneous Query). |

### Mailing labels / exports (9)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Email list | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.OPT_IN=" | Email list of licensees. |
| Mailing List WORKING Dentists | select | dbo_tblDenHyg, dbo_OfficeAffiliation, dbo_tblPLLCs | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.Class="L | Mailing list of offices / dentists. |
| MailingList | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg | Mailing list of offices / dentists. |
| OfficeAssociations | select | dbo_tblDenHyg, dbo_tblPLLCs, dbo_OfficeAffiliation |  | Mailing list of offices / dentists. |
| Offices ALL and Affiliations | select | dbo_OfficeAffiliation, dbo_tblPLLCs, dbo_tblDenHyg | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblDenHyg.Class=" | Mailing list of offices / dentists. |
| Offices LOUISIANA | select | dbo_tblPLLCs | WHERE dbo_tblPLLCs.STATE="LA" AND dbo_tblPLLCs.Notes Not Like "*NOT INSPECT" OR dbo_tblPLLCs.STATE="LA" AND dbo_tblP | Mailing list of offices / dentists. |
| OFFICES--ACTIVE ALL | select | dbo_OfficeAffiliation, Office Permits CORRECT DO NOT EDIT--FOR INSPEC… | WHERE dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblDenHyg.Class=" | Mailing list of offices / dentists. |
| OfficeAssociations ERIN | select | dbo_tblDenHyg, dbo_tblPLLCs, dbo_OfficeAffiliation | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="RET" AND dbo_tblPLLCs.STATE="LA" AND dbo_tblDenHyg.Class="L" | Mailing list of offices / dentists. |
| Offices | select | dbo_tblPLLCs | WHERE dbo_tblPLLCs.STATE="LA" | Mailing list of offices / dentists. |

### Permits & CE reporting (18)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| CE Broker | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB"  | Export to CE Broker (continuing-ed tracking vendor) of licensees/permits. |
| CE Broker 2 Dental | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_Permits.PermitLeve | Export to CE Broker (continuing-ed tracking vendor) of licensees/permits. |
| CE Broker 2 Hygiene | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.Class="L | Export to CE Broker (continuing-ed tracking vendor) of licensees/permits. |
| Copy Of PermitInfo | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" | Office / personal permit information listing. |
| Copy Of PermitInfo 2 | select | dbo_tblDenHyg, dbo_Permits, dbo_tblPLLCs | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" | Office / personal permit information listing. |
| Email personal permits | select | dbo_tblDenHyg, qPermitsforCE | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.Class="L | Office / personal permit information listing. |
| Hygiene anesthesia | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.DateSince=#5/19/2016# AND dbo_Permits.PermitLevel="P" | Office / personal permit information listing. |
| Hygiene permit infor | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.DateSince=#5/19/2016# | Office / personal permit information listing. |
| Office and Personal Permit Information | select | dbo_Permits, dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_Permits.IssueDate>#6/30/2016# And dbo_Permits.IssueDa | Office / personal permit information listing. |
| Office Permits TEST 2 | select | dbo_Permits, dbo_tblDenHyg, dbo_tblPLLCs | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_Permits.PermitLeve | Office / personal permit information listing. |
| PermitInfo | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.STATUS="ACT" AND dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Class="L" AND dbo_Permits.Iss | Office / personal permit information listing. |
| qPermitsforCE | select | dbo_Permits | WHERE dbo_Permits.PermitType="Moderate" Or dbo_Permits.PermitType="Moderate Pediatric" Or dbo_Permits.PermitType="Ge | Office / personal permit information listing. |
| qPermitsforCE 2 | select | dbo_Permits | WHERE dbo_Permits.PermitType="Enteral" Or dbo_Permits.PermitType="Enteral Pediatric" Or dbo_Permits.PermitType="Pare | Office / personal permit information listing. |
| ERIN Office and Personal Permit Information | select | dbo_Permits, dbo_tblDenHyg, dbo_tblPLLCs | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.Class="L | Office / personal permit information listing. |
| Office Permits | select | dbo_tblPLLCs, dbo_Permits, dbo_tblDenHyg | WHERE dbo_Permits.PermitLevel="O" AND dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS= | Office / personal permit information listing. |
| PMP info | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_tblDenHyg.DateUnti | Prescription-monitoring-program (PMP) related licensee info. |
| CE-Broker-2018 | select | dbo_tblDenHyg, qPermitsforCE | WHERE dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB"  | Export to CE Broker (continuing-ed tracking vendor) of licensees/permits. |
| Personal permits for CE | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_Permits.P | Export to CE Broker (continuing-ed tracking vendor) of licensees/permits. |

### Renewals (5)

| Query | Type | Sources | Filter / params | Purpose (guess) |
|---|---|---|---|---|
| Not renewed FOR EMAIL | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Type="D" Or dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS= | Licensees who have not renewed, with email for reminder mailing. |
| Restricted Renewals | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.DateRenew>#6/30/2021# And dbo_tblDenHyg.DateRenew<#7/1/2022# AND dbo_tblDenHyg.Class="T" Or dbo_ | Licensees who have not yet renewed. |
| Not Renewed--DENTAL | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Type="D" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STA | Licensees who have not yet renewed. |
| Not Renewed--HYGIENE | select | dbo_tblDenHyg | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.Type="H" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STA | Licensees who have not yet renewed. |
| Not renewed Dental anesthesia | select | dbo_tblDenHyg, dbo_Permits | WHERE dbo_tblDenHyg.LICENSEID<>"0000" AND dbo_tblDenHyg.STATUS="ACT" Or dbo_tblDenHyg.STATUS="PRB" AND dbo_Permits.P | Dentists with anesthesia permits not renewed. |

Notes on ReportManager queries: all 80 are ad-hoc reporting queries run directly by staff (detail row listings; totals are computed in Excel or the reports, no GROUP BY/aggregate is used). Each of the 8 reports is based on a same-named query. Query last-updated dates (in inventory-raw.json) indicate recency of use; naming such as "Copy Of ...", "TEST 2", "ERIN ..." and "CE-Broker-2018" signals one-off work.

## 5. lsbdapp.mdb - forms by business function

55 forms. Record source = embedded SQL (`~sq_f`) or heuristic first known table/query in the form's property map (flagged *h*). "Writes" = tables the VBA code-behind/modules write to (INSERT/UPDATE/DELETE text or recordset AddNew/Edit).

### Batch print / output panels (5)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmCertsByDate | tblTypes *h* | rptRnwCertByDatePA, rptRnwCertByDatePLLC, rptRnwCertByDateAS, rptDenCardByDate, rptHygCardByDate, rptDenPerPermitsByDate | writes Permits; proc spSetPPLevel | Print certificates/cards/permit letters for a date range (also sets permit level via spSetPPLevel). |
| frmCertsByNum | tblTypes *h* | rptRnwCertByNumPA, rptRnwCertByNumPLLC, rptRnwCertByNumAS, rptDenCardByNum, rptHygCardByNum, rptRegCertByNumPA | - | Print certificates/cards for a certificate number range. |
| frmLabelsPanel | qryCountyCombo *h* | rptDenLabels, rptHygLabels, rptPALabels, rptPLLCLabels, rptASLabels, rptDenLabelsOKI | - | Print mailing labels by licence type. |
| frmRenewalNotices | tblTypes *h* | rptRenewalNoticeIN, rptRenewalNoticePA, rptRenewalNoticePLLC, rptRenewalNoticeAS | - | Print renewal notices by licence type. |
| frmCreateDisk | - | - | Export to text/CSV (TransferText) | Create disk (text-file export for mailing vendor/disk). |

### Complaints & discipline (5)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmComplaint | tblComplStatus *h* | frmVueAllComplaints | AddNew/Edit on recordset (writes rows) | Complaint case entry and maintenance (status, charges, hearings, decisions, probation/closure terms). |
| frmComplaintReports | tblComplStatus *h* | rptComplaintsReport | - | Choose and run complaint reports. |
| frmComplaintSearch | tblComplStatus *h* | frmComplaint, frmVueAllComplaints | - | Search complaints. |
| frmHistoryComplaints | qryHistoryComplaints *h* | - | - | Complaint history for a licensee. |
| frmListComplaints | qryListComplaints *h* | - | - | Browse complaint list. |

### Data maintenance / conversion (1)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| UpdateTables | - | frmListSchools | AddNew/Edit on recordset (writes rows) | Utility: bulk update of key tables (data conversion / fix-ups). |

### Financial / transactions (8)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmEditTransaction | - | frmVueAllFHTrans, frmVueAllCRTrans, frmVueAllCHTrans, frmVueAllTRTrans, frmVueAllINTrans | - | Edit a transaction. |
| frmFindTransaction | - | - | - | Find a transaction. |
| frmNewTransaction | - | - | AddNew/Edit on recordset (writes rows) | Enter a new payment transaction (fees, receipts). |
| frmPeriodicRegister | - | rptPeriodicRegister | - | Print periodic receipts register. |
| frmSplitsRegister | tblTypes *h* | rptPeriodicSplits | - | Print fee-splits register. |
| frmTransHistAS | qryTransHistAS *h* | - | - | Transaction history for a licensee/firm. |
| frmTransHistFirm | qryTransHistFirm *h* | - | - | Transaction history for a licensee/firm. |
| frmTransHistIN | qryTransHistIN *h* | - | - | Transaction history for a licensee/firm. |

### Firm records (PA / PLLC) (3)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmFirm | qryCountyCombo *h* | frmTransHistFirm, frmInspections | Shell/file operations | Firm (PA/PLLC) maintenance form, including office county, affiliations and transaction/inspection links. |
| frmListPAs | qryListPAs *h* | - | - | Browse list of firms. |
| frmListPLLCs | qryListPLLCs *h* | - | - | Browse list of firms. |

### Inspections (1)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmInspections | qInspections *h* | - | - | Office inspection entry. |

### Licensee record (dentists / hygienists) (10)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmEditIndvAffiliations | qIndvAffiliationOptions *h* | - | writes IndividualAffiliation | Edit individual-to-office affiliations. |
| frmEditOfficeAffiliations | qOfficeAffiliationOptions *h* | frmFirm | writes OfficeAffiliation | Edit office affiliations. |
| frmEditOfficePermits | qPermitType *h* | frmFirm | writes Permits | Edit office permits. |
| frmEducationDent | qryExamHistoryDent *h* | - | - | Exam/education history. |
| frmIndividual | qOfficeAffiliations *h* | frmEditIndvAffiliations, frmEditOfficeAffiliations, frmEditOfficePermits, frmEducationDent, frmEducationHyg, frmKeyList | writes IndividualAffiliation/Permits/OfficeAffiliation; AddNew/Edit on recordset (writes rows); Shell/file op… | Main individual licensee screen: demographics, status, affiliations, permits, education, discipline; launches fact sheet, transactions, etc. |
| frmIndividualList | - | - | - | Browse licensee list. |
| frmOfficeAffiliationsDentists | qOfficeAffiliationsDentists *h* | - | - | Office affiliations/permits by dentist listing. |
| frmOfficePermitsDentists | qOfficePermitsDentists *h* | - | - | Office affiliations/permits by dentist listing. |
| frmSelectIndividuals | tblDenHyg | - | - | Select licensees (used by selection/print dialogs). |
| frmEducationHyg | qryExamHistoryHyg *h* | - | - | Exam/education history. |

### Lookups / settings (1)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmListSchools | tblSchools | - | - | School lookup table maintenance. |

### Navigation / shell (5)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmKeyList | - | - | - | Main switchboard / key-lookup screen. |
| frmKeyMain | - | frmComplaintSearch | - | Main switchboard / key-lookup screen. |
| frmMasterPanel | qryCountyCombo *h* | frmASPermit, frmIndividual, frmFirm | - | Master panel: entry point for individual / firm / AS-permit search and open. |
| frmSplash | - | - | - | Startup splash screen (macro OpenfrmSplash). |
| frmMAINSCREEN | - | - | - | Main switchboard / key-lookup screen. |

### Permits (personal / office / anesthesia-sedation) (2)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmASList | - | - | - | List of anesthesia/sedation permits. |
| frmASPermit | qryCountyCombo *h* | frmTransHistAS, frmVueAllIndividuals | - | Anesthesia/sedation permit maintenance. |

### Random audit sampling (1)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmRandomize | - | rptAuditNoticeDen, rptAuditNoticeHyg, rptAuditNoticeAnes, rptAuditNoticeSed | writes tblDenHyg/tblASPermits | Draw random sample of dentists/hygienists/AS permit holders and print audit notices. |

### Record maintenance (CRUD helpers) (1)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmChangeStatus | tblStatus *h* | - | AddNew/Edit on recordset (writes rows) | Bulk change of licence status for a licence type. |

### Renewals (1)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmBatchRenewal | - | - | - | Batch renewal processing (creates renewal transactions/splits in bulk). |

### Settings / administration (3)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| frmDateSettings | tblDates | - | - | Maintains Date settings table (tblDates). |
| frmFeeSettings | tblFees | - | - | Maintains Fee settings table (tblFees). |
| frmNumSettings | tblNumbers | - | - | Maintains Num settings table (tblNumbers). |

### Subforms (embedded in detail forms) (8)

| Form | Record source | Opens (forms / reports) | Writes / notes | Purpose (guess) |
|---|---|---|---|---|
| fsubDisciplinary | qDisciplinary *h* | - | - | Datasheet subform showing Disciplinary for the parent record. |
| fsubEducation | qEducation *h* | - | - | Datasheet subform showing Education for the parent record. |
| fsubIndvAffiliations | qIndvAffiliations *h* | - | - | Datasheet subform showing IndvAffiliations for the parent record. |
| fsubIndvAffiliationsIndirect | qIndvAffiliationsIndirect *h* | - | - | Datasheet subform showing IndvAffiliationsIndirect for the parent record. |
| fsubOfficeAffiliations | qOfficeAffiliations *h* | - | - | Datasheet subform showing OfficeAffiliations for the parent record. |
| fsubOfficePermits | qOfficePermits *h* | - | - | Datasheet subform showing OfficePermits for the parent record. |
| qEducation subform | qEducation | - | - | Datasheet subform showing qEducation subform for the parent record. |
| fsubPersonalPermits | qPersonalPermits *h* | - | - | Datasheet subform showing PersonalPermits for the parent record. |

## 6. Reports

### 6a. lsbdapp.mdb - 80 reports

"Record source status": `OK` = source query/table exists in this file; `MISSING` = embedded record source references an object that does not exist in lsbdapp.mdb (report would fail to open - likely dead/legacy); `-` = none recorded (record source not recoverable from extraction or set in VBA).

### Certificates, cards & permits (41)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptCRCertByDate | - | - | (none found in VBA) | "CR" certificate by date (CR = transaction/certificate type code; meaning to confirm). |
| rptCRCertByNum | - | - | (none found in VBA) | "CR" certificate by number (CR = transaction/certificate type code; meaning to confirm). |
| rptDenCardByDate | qryDenCardBydate | OK | frmCertsByDate | Wallet/licence card by date. |
| rptDenCardByDate-0 | qryDenCardBydate | OK | (none found in VBA) | Wallet/licence card by date. |
| rptDenCardByNum | qryDenCardByNum | OK | frmCertsByNum | Wallet/licence card by number. |
| rptDenHygCardByNum | qryHygCardBydate | OK | (none found in VBA) | Wallet/licence card by number. |
| rptDenOffPermitsByDate | qOfficePermitsByDatesDen | OK | frmCertsByDate | Permit certificate. |
| rptDenOffPermitsByDate-0 | qOfficePermitsByDatesDen | OK | (none found in VBA) | Permit certificate. |
| rptDenPerPermitsByDate | qPersonalPermitsByDatesDen | OK | frmCertsByDate | Permit certificate. |
| rptHygCardByDate | qryHygCardBydateMaster | OK | frmCertsByDate | Wallet/licence card by date. |
| rptHygCardByDate-0 | qryHygCardBydate | OK | (none found in VBA) | Wallet/licence card by date. |
| rptHygCardByDate-1 | qryHygCardBydate | OK | (none found in VBA) | Wallet/licence card by date. |
| rptHygCardByDateCred | qryHygCardBydate | OK | (none found in VBA) | Wallet/licence card by date. |
| rptHygCardByNum | qryHygCardByNum | OK | frmCertsByNum | Wallet/licence card by number. |
| rptHygPerPermitsByDate | qPersonalPermitsByDatesHyg | OK | frmCertsByDate | Permit certificate. |
| rptINCardByNum | qryINCardByNum | MISSING (qryINCardByNum) | (none found in VBA) | Wallet/licence card by number. |
| rptRegCertByDateDen | qryRegCertByDateDen | OK | frmCertsByDate | Initial registration/licence certificate printed by date. |
| rptRegCertByDateDenCredentialing | qryddscredential | MISSING (qryddscredential) | (none found in VBA) | Initial registration/licence certificate printed by date - credentialing variant. |
| rptRegCertByDateHyg | qryRegCertByDateHyg | OK | frmCertsByDate | Initial registration/licence certificate printed by date. |
| rptRegCertByDateHygCred | qrydhcredential | MISSING (qrydhcredential) | (none found in VBA) | Initial registration/licence certificate printed by date - credentialing variant. |
| rptRegCertByDateHygCredentialing | qrydhcredential | MISSING (qrydhcredential) | (none found in VBA) | Initial registration/licence certificate printed by date - credentialing variant. |
| rptRegCertByDatePA | qryRegCertByDatePA | OK | frmCertsByDate | Initial registration/licence certificate printed by date. |
| rptRegCertByNumDate | qryRegCertByNumDen | OK | (none found in VBA) | Initial registration/licence certificate printed by number. |
| rptRegCertByNumDen | qryRegCertByNumDen | OK | frmCertsByNum | Initial registration/licence certificate printed by number. |
| rptRegCertByNumDenCredentialing | qryddscredential | MISSING (qryddscredential) | (none found in VBA) | Initial registration/licence certificate printed by number - credentialing variant. |
| rptRegCertByNumHyg | qryRegCertByNumHyg | OK | frmCertsByNum | Initial registration/licence certificate printed by number. |
| rptRegCertByNumHygCredentialing | qrydhcredential | MISSING (qrydhcredential) | (none found in VBA) | Initial registration/licence certificate printed by number - credentialing variant. |
| rptRegCertByNumPA | qryRegCertByNumPA | OK | frmCertsByNum | Initial registration/licence certificate printed by number. |
| rptRegCertInstructor | qryINSTRUCTOR | MISSING (qryINSTRUCTOR) | (none found in VBA) | Initial registration/licence certificate printed by date (instructor licence). |
| rptRegCertVolunteer | qryvolunteer | MISSING (qryvolunteer) | (none found in VBA) | Initial registration/licence certificate printed by date (volunteer licence). |
| rptRnwCertByDateAS | qryRnwCertByDateAS | OK | frmCertsByDate | Renewal certificate by date. |
| rptRnwCertByDatePA | qryRnwCertByDatePA | OK | frmCertsByDate | Renewal certificate by date. |
| rptRnwCertByDatePLLC | qryRnwCertByDatePLLC | OK | frmCertsByDate | Renewal certificate by date. |
| rptRnwCertByNumAS | qryRnwCertByNumAS | OK | frmCertsByNum | Renewal certificate by number. |
| rptRnwCertByNumPA | qryRnwCertByNumPA | OK | frmCertsByNum | Renewal certificate by number. |
| rptRnwCertByNumPLLC | qryRnwCertByNumPLLC | OK | frmCertsByNum | Renewal certificate by number. |
| rptHygCardByDate0 | qryHygCardBydate | OK | (none found in VBA) | Wallet/licence card by date. |
| rptINCardByDate | qryINCardByDate | MISSING (qryINCardByDate) | (none found in VBA) | Wallet/licence card by date. |
| rptRegCertByDatePLLC | qryRegCertByDatePLLC | OK | frmCertsByDate | Initial registration/licence certificate printed by date. |
| rptRegCertByNumPLLC | qryRegCertByNumPLLC | OK | frmCertsByNum | Initial registration/licence certificate printed by number. |
| rptDenCardByDate-1 | qryDenCardBydate | OK | (none found in VBA) | Wallet/licence card by date. |

### Complaints & discipline (2)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptLogCorrespondence | tblLogofCorrespondence | MISSING (tblLogofCorrespondence) | (none found in VBA) | Log of correspondence. |
| rptComplaintsReport | - | - | frmComplaintReports | Complaints report. |

### Financial / transactions (2)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptPeriodicRegister | qryPeriodicRegiser | OK | frmPeriodicRegister | Periodic receipts register. |
| rptPeriodicSplits | qryPeriodicSplits | OK | frmSplitsRegister | Periodic fee-splits register. |

### Licensee & applicant lists (5)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptDDSApplicants | qryDdsapplicants | MISSING (qryDdsapplicants) | (none found in VBA) | List report: rptDDSApplicants. |
| rptDHApplicants | qrydhapplicants | MISSING (qrydhapplicants) | (none found in VBA) | List report: rptDHApplicants. |
| rptNonprofInternList | tblNonprofInternList | MISSING (tblNonprofInternList) | (none found in VBA) | List report: rptNonprofInternList. |
| rtpddsLicensereportOKI | QryLICReport | MISSING (QryLICReport) | (none found in VBA) | List report: rtpddsLicensereportOKI. |
| rtpdhLicensereportOKI | QryLICReport | MISSING (QryLICReport) | (none found in VBA) | List report: rtpdhLicensereportOKI. |

### Licensee fact sheet (1)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptFactSheet | qryByKeyIndividualFS | OK | frmIndividual | One-page licensee fact sheet with discipline, affiliations, permits, education, complaints sub-reports. |

### Mailing labels / exports (7)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptASLabels | qryanes/sedlabels | MISSING (qryanes/sedlabels) | frmLabelsPanel | Mailing labels. |
| rptCheshireIN | qryINLabels | OK | (none found in VBA) | Mailing labels. |
| rptHygLabels | QryLic | MISSING (QryLic) | frmLabelsPanel | Mailing labels. |
| rptPALabels | qryPALabels | OK | frmLabelsPanel | Mailing labels. |
| rptPLLCLabels | qryPLLCLabels | OK | frmLabelsPanel | Mailing labels. |
| RptRenewalNoticeLabelsPALaser | QryRenewalNoticeLabelsPALaser | MISSING (QryRenewalNoticeLabelsPALaser) | (none found in VBA) | Mailing labels. |
| rptDenLabels | QryLic | MISSING (QryLic) | frmLabelsPanel | Mailing labels. |

### Random audit sampling (7)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptAuditNoticeAnes | qryRandAnes | OK | frmRandomize | Audit notice letter for randomly selected licensees. |
| rptAuditNoticeDenX | tblRndDentists | OK | (none found in VBA) | Audit notice letter for randomly selected licensees. |
| rptAuditNoticeHyg | tblRndHygienists | OK | frmRandomize | Audit notice letter for randomly selected licensees. |
| rptAuditNoticeHygX | tblRndHygienists | OK | (none found in VBA) | Audit notice letter for randomly selected licensees. |
| rptAuditNoticeIn | tblRndDentists | OK | (none found in VBA) | Audit notice letter for randomly selected licensees. |
| rptAuditNoticeSed | qryRandSed | OK | frmRandomize | Audit notice letter for randomly selected licensees. |
| rptAuditNoticeDen | tblRndDentists | OK | frmRandomize | Audit notice letter for randomly selected licensees. |

### Renewal notices (5)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rptRenewalNoticePA | qryRenewalNoticePA | OK | frmRenewalNotices | Renewal notice letter. |
| RptRenewalNoticePALate | QryPALate | OK | (none found in VBA) | Renewal notice letter (late). |
| rptRenewalNoticePLLC | qryRenewalNoticePLLC | OK | frmRenewalNotices | Renewal notice letter. |
| RptRenewalNoticePLLC2 | qryRenewalNoticePLLC | OK | (none found in VBA) | Renewal notice letter. |
| RptRenewalNoticePLLCLate2 | qryRenewalNoticePLLC | OK | (none found in VBA) | Renewal notice letter (late). |

### Sub-reports (embedded) (10)

| Report | Record source | Record-source status | Opened from | Purpose (guess) |
|---|---|---|---|---|
| rsubComplaintsFS | qComplaintsFS | OK | (none found in VBA) | Sub-report for ComplaintsFS. |
| rsubDisciplinaryFS | qDisciplinaryFS | OK | (none found in VBA) | Sub-report for DisciplinaryFS. |
| rsubIndvAffiliationsFS | qIndvAffiliationsFS | OK | (none found in VBA) | Sub-report for IndvAffiliationsFS. |
| rsubOfficeAffiliationsFS | qOfficeAffiliationsFS | OK | (none found in VBA) | Sub-report for OfficeAffiliationsFS. |
| rsubOfficePermitsFS | qOfficePermitsFS | OK | (none found in VBA) | Sub-report for OfficePermitsFS. |
| rsubPersonalPermitsFS | qPersonalPermitsFS | OK | (none found in VBA) | Sub-report for PersonalPermitsFS. |
| rsubPersonalPermitsHyg | qPersonalPermitsByDatesHygComb | OK | (none found in VBA) | Sub-report for PersonalPermitsHyg. |
| rsubPersonalPermitsHygA | qPersonalPermitsByDatesHygComb | OK | (none found in VBA) | Sub-report for PersonalPermitsHygA. |
| rsubPersonalPermitsHygB | qPersonalPermitsByDatesHygComb | OK | (none found in VBA) | Sub-report for PersonalPermitsHygB. |
| rsubEducationFS | qEducationFS | OK | (none found in VBA) | Sub-report for EducationFS. |

### 6b. ReportManager.accdb - 8 reports

| Report | Record source (same-named query) | Purpose (guess) |
|---|---|---|
| Copy Of PAPER Renewal Totals | PAPER Renewal Totals | Count/totals of paper renewals (a copy - likely obsolete). |
| Not Renewed--DENTAL | Not Renewed--DENTAL | Printable list of licensees who have not renewed. |
| Not Renewed--HYGIENE | Not Renewed--HYGIENE | Printable list of licensees who have not renewed. |
| ONLINE Renewal Totals | ONLINE Renewal Totals | Count/totals of online renewals. |
| Renewal Totals--DENTAL | Renewal Totals--DENTAL | Renewal totals by licence type. |
| Renewal Totals--HYGIENE | Renewal Totals--HYGIENE | Renewal totals by licence type. |
| Renewal Transactions | Renewal Transactions | Renewal transactions list. |
| PAPER Renewal Totals | PAPER Renewal Totals | Count/totals of paper renewals. |

## 7. VBA modules (names and procedures only)

| Module | Procedures | Purpose (guess) | DB writes / special features |
|---|---|---|---|
| modAutoIDs | getAutoId, setAutoId | Generate/advance sequential ids (licence numbers and keys) from tblNumbers. | AddNew/Edit on recordset (writes rows) |
| modBatchRenewals | renewBatch, SaveTransBatch | Batch renewal: create renewal transactions for selected licensees. | AddNew/Edit on recordset (writes rows) |
| modDataConversion | DateConverter, SSNConverter, convertNames, PhoneConverter, initValues, incrmntValues, appendValues | One-time legacy data conversion helpers (dates, SSN, phone, names). | AddNew/Edit on recordset (writes rows) |
| modDisplayASPermits | getASByKey, getASList, displayASPermit | Load and display anesthesia/sedation permit records on the form. | - |
| modDisplayComplaint | getComplaintList, getComplaintByKey, displayComplaint | Load and display complaint records. | - |
| modDisplayFirms | getPLLCList, getPAList, getPAByKey, getPLLCByKey, displayFirm | Load and display PA/PLLC firm records. | - |
| modDisplayIndividual | getIndividualByKey, getIndividualList, displayIndividual, setViewDocParms, customizeIndForm, customizeIndFormE | Load and display individual licensee records; form customisation per licence type. | - |
| modDisplayLists | displayIndividualInfo, displayIndividualInfoDH, displayList, displayListCont, displaySchools, displayIndividualList | Open list/search forms and individual info dialogs. | - |
| modDisplayTransactions | displayTransaction, getTransaction, openNewTrans | Load and open transaction forms. | - |
| modGlobalData | initBatchRenewal | Global variables/init for batch renewal and date settings. | - |
| modPrintMailDates | SetPrintMailDates, SetPrintMailDatesN | Stamp print/mail dates on transactions after certificate/card batches. | AddNew/Edit on recordset (writes rows) |
| modRefreshTableLinks | CheckLinks, RefreshLinks, RelinkTables | Check and re-link ODBC linked tables at startup. | Refresh ODBC links (TableDefs/Connect) |
| modSaveASPermit | setASByKey, saveASPermit | Persist anesthesia/sedation permits. | AddNew/Edit on recordset (writes rows) |
| modSaveComplaint | updDenHygComplaint, setComplaintByKey, saveComplaint | Persist complaints and update respondent licensee record. | AddNew/Edit on recordset (writes rows) |
| modSaveFirm | setPAByKey, setPLLCByKey, saveFirm | Persist PA/PLLC firm records. | AddNew/Edit on recordset (writes rows) |
| modSaveIndividual | setIndividualByKey, saveIndividual | Persist individual licensee records. | AddNew/Edit on recordset (writes rows) |
| modSaveTransactions | SaveTransaction, SetTransaction, setFees | Persist payment transactions; compute fees from tblFees. | AddNew/Edit on recordset (writes rows) |
| modTransSplits | SaveTransSplits, SaveTransSplitsBatch, AddTransSplit, initTransSplits | Create fee-split rows for each transaction. | AddNew/Edit on recordset (writes rows) |
| modUtilities | getRecordSet, getRecordSet2, deleteEntity, getRecordSetMsg | Generic recordset helpers and entity delete. | - |
| modValidateKeys | validateSpecialty, validateFirmKeys, validateINDKeys, validateComplaintKeys, validateASKeys | Validation of licence/key uniqueness and specialty per entity. | - |

Form/report code-behind: 53 forms and 8 reports have class modules; per-object procedure lists are in `inventory-raw.json` (objects.forms[].code.procedures). Stored-procedure references found in VBA: spSetPPLevel.

Macros (names only): menubarExitCommon, menubarMain, menubarPrtAndExit, menuExit, menuExitCommon, menuItemPrtCerts, menuItemVueAllTrans, menuLicensing, menuPrintUtils, menuPrtAll, menuSettings, menuTransactions, OpenfrmSplash. These are the menubar/menu command macros (exit, print, licensing, transactions, settings) plus `OpenfrmSplash`.

## 8. Likely functions the new web app must replicate

- **Licensee search and open (dentists, hygienists, EDDAs).** Search/browse by name/id/key and open the individual record.  
  *Access objects:* frmMasterPanel, frmKeyMain, frmKeyList, frmIndividualList, frmSelectIndividuals, qryIndividualList, qryByKeyIndividual, modDisplayIndividual, modDisplayLists
- **Licensee record maintenance (CRUD).** Create/edit/delete individual licensee with demographics, status, class, county, election district; key/id validation.  
  *Access objects:* frmIndividual, fsub* subforms, modSaveIndividual, modValidateKeys (validateINDKeys, validateSpecialty), qryByKeyIndividual/qryByIdIndividual/qryDeleteIndividual, modAutoIDs
- **Firm/office records (PA and PLLC) maintenance.** Maintain professional associations and PLLCs with county/location and status; list them.  
  *Access objects:* frmFirm, frmListPAs, frmListPLLCs, modDisplayFirms, modSaveFirm, qryByKeyPA, qryByKeyPLLC, qryListPAs, qryListPLLCs, qryDeletePA/PLLC, qryUpdNullPLLC
- **Dentist/hygienist to office (firm) affiliations.** Link individuals to offices and display both directions (direct and indirect).  
  *Access objects:* frmEditIndvAffiliations, frmEditOfficeAffiliations, frmOfficeAffiliationsDentists, fsubIndvAffiliations(+Indirect), fsubOfficeAffiliations, qIndvAffiliations*, qOfficeAffiliations*, tblIndividualAffiliation/OfficeAffiliation
- **Permits: personal and office permits.** Issue/edit personal and office permits (types, dates) with listing by date range.  
  *Access objects:* frmEditOfficePermits, frmOfficePermitsDentists, fsubPersonalPermits, fsubOfficePermits, qPersonalPermits*, qOfficePermits*, PermitType, frmCertsByDate (spSetPPLevel)
- **Anesthesia / sedation permits.** Issue and renew anesthesia/sedation permits, evaluator listing, not-renewed tracking, labels.  
  *Access objects:* frmASPermit, frmASList, modDisplayASPermits, modSaveASPermit, qryAS*, qryBy*AS*, qryAnesSedRenewal, qryASNotrenewed, qrysedevaluators, rptRnwCert*AS, rptAuditNoticeAnes/Sed
- **Licence status changes.** Change status (active, probation, etc.) singly/in bulk for individuals, PAs, PLLCs, AS permits.  
  *Access objects:* frmChangeStatus, qryChangeStatusIN/PA/PLLC/AS, tblStatus, tblnactiveStatus
- **Renewal processing (batch and single).** Generate renewal transactions, fees and splits; batch renewal; identify not-renewed and late.  
  *Access objects:* frmBatchRenewal, modBatchRenewals, modGlobalData, frmNewTransaction, modSaveTransactions, modTransSplits, qryRenewalNotice*, qryRenewalDdsIN/DHIN, qryRnwExpDDS&DH, qryRenewalDhlate, qryPaPastDue, ReportManager "Not renewed..." queries
- **Renewal notices and late notices.** Produce renewal and late-renewal letters for individuals, PAs, PLLCs, AS permits.  
  *Access objects:* frmRenewalNotices, rptRenewalNotice*, RptRenewalNotice*Late, qryRenewalNotice*, QryPALate, qryPLLClate
- **Late fees / fee schedule.** Fee table drives renewal/late fee computation; fees are settable by staff.  
  *Access objects:* frmFeeSettings, tblFees, modSaveTransactions (setFees), frmDateSettings (tblDates), frmNumSettings (tblNumbers), tblChargeCategory
- **Payment transactions and fee splits.** Enter/find/edit payments; create split allocations; transaction history by licensee/firm/AS; receipts and splits registers.  
  *Access objects:* frmNewTransaction, frmEditTransaction, frmFindTransaction, frmTransHistIN/Firm/AS, modSaveTransactions, modTransSplits, frmPeriodicRegister, frmSplitsRegister, rptPeriodicRegister, rptPeriodicSplits, tblTransactions, tblTransSplits, tblTransTypes
- **Certificates, wallet cards, permit letters - print by date and by number.** Print initial/renewal certificates and cards for ranges; stamp print/mail dates; credentialing/volunteer/instructor variants.  
  *Access objects:* frmCertsByDate, frmCertsByNum, rptRegCert*, rptRnwCert*, rpt*CardBy*, rpt*PerPermitsByDate, rptDenOffPermitsByDate, modPrintMailDates, qrySetPrintMailDates*, qryRegCertBy*, qryRnwCertBy*
- **Mailing labels and data exports.** Labels by licence type; create disk/text export for mailing; electoral-district and other mailing lists; CE Broker exports (ReportManager).  
  *Access objects:* frmLabelsPanel, rpt*Labels, rptCheshireIN, frmCreateDisk (TransferText), qryDiskUNCDen/Hyg, ReportManager: CE Broker*, Mailing List*, Electoral District Mailing List, Email list
- **Random audit sampling and audit notices.** Draw random samples of dentists/hygienists/anesthesia/sedation holders; print audit notices; results in tblRnd*.  
  *Access objects:* frmRandomize, tblRndDentists/Hygienists/Anesthesia/Sedation, qryRand*, rptAuditNotice*
- **Complaints intake, tracking and discipline.** Complaint entry with charges, hearings, decisions, probation/closure terms; search; history; reports; update respondent status.  
  *Access objects:* frmComplaint, frmComplaintSearch, frmListComplaints, frmHistoryComplaints, frmComplaintReports, rptComplaintsReport, modSaveComplaint, modDisplayComplaint, tblComplaints + tblCompl* lookups, Disciplinary, qDisciplinary
- **Office inspections.** Record inspections and (in ReportManager) track completed/not-inspected/follow-up per round.  
  *Access objects:* frmInspections, qInspections, Inspections table, ReportManager: Office Inspections* queries, InspectionDetails/InspectionStatus links
- **Education and exam history.** Show/maintain exam and education history for dentists and hygienists; school list.  
  *Access objects:* frmEducationDent, frmEducationHyg, frmListSchools, fsubEducation, tblExamsDent/Hyg, Education, tblSchools, qryExamHistory*
- **Licensee fact sheet (public/internal summary).** One-page composite of licensee, discipline, affiliations, permits, education, complaints.  
  *Access objects:* rptFactSheet, rsub*FS, qryByKeyIndividualFS, q*FS
- **Reference data / settings administration.** Maintain lookup and control tables (statuses, types, classes, specialties, counties, charges, fee schedule, date and number counters).  
  *Access objects:* frmDateSettings, frmNumSettings, frmFeeSettings, frmListSchools, tblStatus, tblTypes, tblClass, tblSpecialties, tblCounties, Cities, Zipcodes, ElectionDistricts
- **User access / audit.** Users table and the SQL-side Logins audit; per-user front-end copies.  
  *Access objects:* Users (linked), modRefreshTableLinks; dbo.Logins exists server-side but is not linked in lsbdapp (see questions)
- **Renewal reporting for management (ReportManager).** Totals of paper vs online renewals, dental vs hygiene, not-renewed lists; renewal certification lookups.  
  *Access objects:* ReportManager reports/queries: Renewal Totals*, PAPER/ONLINE Renewal Totals, Renewal Transactions, Not Renewed*; linked dbo.RenewalCertification, RenewalDetails
- **Ad hoc regulatory extracts (ReportManager).** Board/legislative/vendor requests: CE Broker feeds, PMP info, complaints by election district, revocations/retired/restricted lists, new licensees with education, OMFS education, applicants.  
  *Access objects:* ReportManager queries (see §4)
- **Data conversion / maintenance utilities.** Legacy conversion helpers and bulk fix-ups (likely not needed post-migration).  
  *Access objects:* modDataConversion, UpdateTables form, qryUpdNullPLLC
- **Startup and ODBC relinking.** Startup splash, link check/refresh - replaced by auth/session and DB connection in the new app.  
  *Access objects:* frmSplash, OpenfrmSplash macro, modRefreshTableLinks, menu macros

## 9. Open questions for staff

1. VBA opens objects that do not exist in this file - dead code paths or objects removed? Forms: frmVueAllIndividuals, frmVueAllComplaints, frmVueAllFHTrans, frmVueAllCRTrans, frmVueAllCHTrans, frmVueAllTRTrans, frmVueAllINTrans. Reports: rptHygOffPermitsByDate, rptDenLabelsOKI, rptHygLabelsOKI, rptPALabelsOKI, rptPLLCLabelsOKI, rptASLabelsOKI, rptRenewalNoticeIN, rptRenewalNoticeAS. Queries: none. Are there other front-end copies that still have them (e.g. the "frmVueAll*" transaction/individual/complaint view forms, OKI label reports)?
2. Transaction-type codes seen in form/object names (CR, CH, FH, TR, IN, AS, PA, PLLC): what does each mean, and which are still active? (frmEditTransaction dispatches to frmVueAll{FH,CR,CH,TR,IN}Trans, none of which exist here.)
3. ReportManager has a query literally named "Password" over tblDenHyg, and lsbdapp/ReportManager both expose tblDenHyg in full. What is the password field used for (online-portal login?), and who may see it? (Confirm before any data is migrated; see the PII notes in the migration plan.)
4. Which of the 80 lsbdapp reports do you still print? 19 reports point at queries that no longer exist in the file (rptASLabels, rptDDSApplicants, rptDHApplicants, rptHygLabels, rptINCardByNum, rptLogCorrespondence, rptNonprofInternList, rptRegCertByDateDenCredentialing, rptRegCertByDateHygCred, rptRegCertByDateHygCredentialing, rptRegCertByNumDenCredentialing, rptRegCertByNumHygCredentialing, rptRegCertInstructor, rptRegCertVolunteer, RptRenewalNoticeLabelsPALaser, rtpddsLicensereportOKI, rtpdhLicensereportOKI, rptDenLabels, rptINCardByDate) and cannot open as-is. 34 reports are not opened by any form's VBA (could be opened from menus/macros or by hand): rptAuditNoticeDenX, rptAuditNoticeHygX, rptAuditNoticeIn, rptCheshireIN, rptCRCertByDate, rptCRCertByNum, rptDDSApplicants, rptDenCardByDate-0, rptDenHygCardByNum, rptDenOffPermitsByDate-0, rptDHApplicants, rptHygCardByDate-0, rptHygCardByDate-1, rptHygCardByDateCred, rptINCardByNum, rptLogCorrespondence, rptNonprofInternList, rptRegCertByDateDenCredentialing, rptRegCertByDateHygCred, rptRegCertByDateHygCredentialing, rptRegCertByNumDate, rptRegCertByNumDenCredentialing, rptRegCertByNumHygCredentialing, rptRegCertInstructor, rptRegCertVolunteer, RptRenewalNoticeLabelsPALaser, RptRenewalNoticePALate, RptRenewalNoticePLLC2, rtpddsLicensereportOKI, rtpdhLicensereportOKI, rptHygCardByDate0, rptINCardByDate, RptRenewalNoticePLLCLate2, rptDenCardByDate-1.
5. Are the OKI-printer label/report variants (rptXLabelsOKI, rtpddsLicensereportOKI, rtpdhLicensereportOKI) still used? Do you still print on pre-printed certificate/card stock?
6. Credentialing, volunteer, instructor and "DDS/DH Applicants" certificate reports: are those licence categories still issued?
7. 38 saved queries have no static reference from any form, report or module (may be dynamically called or orphaned): qLkupOffice, qOfficePermitsByDatesDenList, qPersonalPermitsByDatesDen0, qPersonalPermitsByDatesDenComb, qPersonalPermitsByDatesDenList, qryAnesSedRenewal, qryASLabels, qryASList, qryASNotrenewed, qryByIdASName, qryComplaintReports, qryHygCardBydate-0, qryHygCardBydateSub, qryIndividualList, qryPAreg, qryPArenewalnotice, qryPLLClate, qryPLLCreg, qryRandHyg, qryRenewalDdsIN, qryRenewalDHIN, qryRenewalNoticeAS, qryRenewalNoticeAS2, qryRenewalNoticeIN, qryRenewalNoticePALate, qryRnwExpDDS&DH, qrysedevaluators, qryTransHist, qryUpdComplaint, qryUpdNullPLLC, qElectionDistricts, qOfficePermitsByDatesDen00, qryDenCardBydate-0, qryFirmTypes, qryPA, qryPaPastDue, qryRandDentists, qryRenewalDhlate. Which are used (e.g. by name in a VBA-built string)?
8. ReportManager.accdb: which of its 80 queries do you actually run each cycle? Which were one-offs (names containing "Copy Of", "TEST", "ERIN", "CE-Broker-2018")? Should CE Broker feeds, PMP info, legislative/election-district mailing lists be generated by the new app?
9. Online vs paper renewals: the ReportManager totals split "ONLINE" and "PAPER" renewals. Online renewals already land in tblTransactions (RefNum = "ONLINE"; paper ones have other RefNums). Are they written by the third-party portal or a server job, and does the new app need to ingest those payments/transactions, or replace the portal?
10. Fee and late-fee rules live in tblFees plus VBA; transactions carry Fee, AssFEE (association fee), WellBeingFee, Penalty, Total, ExpYEAR and DateRenew columns (modSaveTransactions.setFees, modTransSplits). Need a written description of the fee schedule, late-fee triggers (dates in tblDates), and how transactions are split between accounts.
11. Numbering: tblNumbers and modAutoIDs generate licence/certificate/transaction numbers. Are number formats (prefixes, sequences by type) legally/externally significant? Must the new system continue the existing sequences?
12. Status codes (CUR, PRB, REP, etc.), Class codes (L, C, V, T, ...) and Type codes (D, H, E, PA, LL ...) - please confirm the meaning and which are public-visible. Is a PA "professional association" and are the AS tables "anesthesia/sedation"? (Inferred from names.)
13. What does spSetPPLevel (called from frmCertsByDate) do in the certificate print workflow, and is that permit-level recalculation still required? Are there other server-side jobs/triggers not visible from Access?
14. Random audit sampling: what criteria define the pool and the sample size, is the draw repeatable/auditable, and where do results/responses get recorded (tblRnd*)?
15. Complaints are "internal only": who needs access to which stages (intake, hearing, decision, probation terms), and which disciplinary outcomes are published on the public site?
16. Inspections: is the round-based tracking (attempted/closed/follow-up/not required) done only in ReportManager queries? Should the new app manage inspections end to end (dbo.InspectionDetails / InspectionStatus)?
17. Server tables not exposed in lsbdapp (Logins, RenewalCertification, RenewalDetails, AssociationHistory, AddressHistory, OfficeAffHistory, VSAuth, VsCapture, Parishes, InspectionDetails...) - which are fed by the online renewal portal or other systems, and must they be kept?
18. How many staff use the Access app concurrently and what are the role differences (Users table)? Is row-level permission needed (e.g. only certain staff may change status or fees)?
19. Are there other Access files (ReportManager copies per user, Iris' renewals .mdb, email/confirmation .mdb) whose functions are not covered by these two?

## 10. Method and caveats

- Objects were classified from `MSysObjects.Type` (1 table, 4 ODBC link, 5 query, -32768 form, -32764 report, -32761 module, -32766 macro). Hidden `~sq_*` queries are Access-generated embedded record/row sources (`~sq_f`=form record source, `~sq_c`=form control row source, `~sq_r`=report record source, `~sq_d`=report sub-report/child).
- Query SQL is reconstructed from MSysQueries (attributes 5 sources, 6 columns, 7 joins, 8 WHERE, 11 ORDER BY, 2 parameters). Join nesting and DISTINCT/TOP flags are best effort (attribute-3 flag is recorded but not decoded). Reconstructed SQL is in `inventory-raw.json` (`sql`).
- Forms and reports: layout, controls, captions and events are not parsed (binary design data). Record sources come from embedded `~sq_` queries where present; otherwise a heuristic first match from the object's property map (*h*). The VBA class-module procedure lists (incl. event handlers) and object cross-references are extracted exactly.
- Static-reference analysis cannot see names assembled at run time, so "unreferenced" objects need staff confirmation.
- No row data was read. Stored connection credentials were redacted (`UID=***`, `PWD=***`); SQL text in VBA was not reproduced.