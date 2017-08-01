

// [[Rcpp::depends(RcppArmadillo)]]
// [[Rcpp::plugins(openmp)]]
// [[Rcpp::plugins(cpp11)]]
// [[Rcpp::depends(RcppArmadillo)]]
// [[Rcpp::depends(RcppProgress)]]

#include "pagoda2.h"

#include <string>
#include <iostream>
#include <cstdint>
#include <fstream>
#include <string.h>
#include <list>
#include <stdlib.h>
#include <sstream>
#include <string>

#define BOOST_FILESYSTEM_VERSION 3
#define BOOST_FILESYSTEM_NO_DEPRECATED
#include <boost/filesystem.hpp>




// Exception codes
#define EX_MEM_ALLOC_FAIL 0x0001


using namespace std;
namespace fs = ::boost::filesystem;

// File format constants
// The block size in bytes
// Set to 2MB because this allows accessing the full file size
// Allowable by javascript MAX_SAFE_INTEGER to address file positions
// Number.MAX_SAFE_INTEGER = 9007199254740991
// Max Int32 Value: 4294967295
// Number.MAX_SAFE_INTEGER / 4294967295 = 2097152 =  2 * (1024)^2
#define FILE_BLOCK_SIZE ((uint64_t) 2097152)

// File format stucts
struct fileHeader {
  char identifier[32];
  uint8_t versionMajor;
  uint8_t versionMinor;
  uint16_t flags;
  // Uint32 because JS doesn't support 64 bit ints
  uint32_t blockSize; // In bytes
  uint32_t headerSize; // In bytes
  uint32_t indexSize; // In bytes
};


struct indexEntry {
  char key[128];
  uint32_t sizeBlocks; // size in blocks
  uint32_t offset; // In blocks after index
  uint32_t flags;
};


struct sparseMatrixHeader {
  // Offsets with respect to the beginning of the beginning of the
  // First block
  uint32_t dim1;
  uint32_t dim2;
  uint32_t pStartOffset;
  uint32_t iStartOffset;
  uint32_t xStartOffset;
  uint32_t dimname1StartOffset;
  uint32_t dimname2StartOffset;
  uint32_t dimname2EndOffset;
};

// Program structs
// Program structs
// Keeping track of entries

struct entry {
  char key[128];
  void* payload;
  uint64_t size; // bytes
  uint32_t blockSize; // size in blocks as will be written in the index
};

// Function prototypes

template <typename T> inline T intDivRoundUP(T a, T b) {
return(a + b -1) /b;
}

// Struct entry define make_entry_from_string function:
// Author Nikolas Barkas
struct entry *make_entry_from_string(char const *key, string &data)
{
    struct entry *e;
    e = (struct entry *)malloc(sizeof(struct entry));
    if (e == 0)
    {
        throw EX_MEM_ALLOC_FAIL;
    }

    memset(e, 0, sizeof(entry));
    strcpy(e->key, key);
    uint64_t entryLengthBytes = data.length();
    e->payload = malloc(entryLengthBytes); // second allo, in case we want to free this need to be freed too
    if (e->payload == 0)
    {
        throw EX_MEM_ALLOC_FAIL;
    }

    memcpy(e->payload, data.c_str(), entryLengthBytes);
    e->size = entryLengthBytes;
    e->blockSize = (uint32_t)intDivRoundUP(entryLengthBytes, FILE_BLOCK_SIZE);

    return e;
}

template <class T>
std::list<T>* IVtoL(Rcpp::IntegerVector f)
{
    std::list<T>* s;
    s = new list<T>;

    for (int i = 0; i < f.size(); i++)
    {
        T val(f[i]);
        // s[i] = T(f[i]);
        s->push_back(val);
    }
    return (s);
}

template <class T>
std::list<T>* NVtoL(Rcpp::NumericVector f)
{
    std::list<T>* s;
    s = new list<T>;

    for (int i = 0; i < f.size(); i++)
    {
        T val(f[i]);
        // s[i] = T(f[i]);
        s->push_back(val);
    }
    return (s);
}
// Included export to binary function for the Webobject
// Author: Simon Steiger
// [[Rcpp::export]]
void WriteListToBinary(List expL, std::string outfile)
{
    // Read in JSON formatted strings from R List given by List expL
    string cellmetadataData = expL["cellmetadata"];
    string cellorderData = expL["cellorder"];
    string geneinformationData = expL["geneinformation"];
    string reduceddendrogramData = expL["reduceddendrogram"];
    string embeddingstructureData = expL["embeddingstructure"];
    string aspectInformationData = expL["aspectInformation"];
    string genesetsData = expL["genesets"];
    string genesetsgenesData = expL["genesetGenes"];

    // Reading in the names of exported Embeddings:
    vector<string> embedList = expL["embedList"];


    // Read both sparse matrices into NumericVectors
    // Sparse Matrix
    // NumericVector SmatX = expL["matsparse_x"];
    // IntegerVector SmatI = expL["matsparse_i"];
    // expL["matsparse_p"];
    // expL["matsparse_Dim"];

    // // Aspect matrix
    // expL["mataspect_x"];
    // expL["mataspect_x"];
    // expL["mataspect_x"];
    // expL["mataspect_x"];

    // Structure list<entry> as defined in pagoda2.h - List for all entries
    list<entry> entries;

    // Make Entry from each JSON string passed by expL
    // - Cellmetadata:
    struct entry *metadataEntry = make_entry_from_string("cellmetadata", cellmetadataData);
    entries.push_back(*metadataEntry);

    // - Cellorder:
    struct entry *cellorderEntry = make_entry_from_string("cellorder", cellorderData);
    entries.push_back(*cellorderEntry);

    // - Geneinformation:
    struct entry *geneinformationEntry = make_entry_from_string("geneinformation", geneinformationData);
    entries.push_back(*geneinformationEntry);

    // - Reduced Dendrogram
    struct entry *reduceddendrogramEntry = make_entry_from_string("reduceddendrogram", reduceddendrogramData);
    entries.push_back(*reduceddendrogramEntry);

    // - EmbeddingStructure
    struct entry *embeddingstructureEntry = make_entry_from_string("embeddingstructure", embeddingstructureData);
    entries.push_back(*embeddingstructureEntry);

    // Reading all exported Embeddings into entries. Iteration over embedList
    for (int embedIndex = 0; embedIndex != embedList.size(); ++embedIndex)
    {
        string AembedName = embedList[embedIndex];
        size_t lastindex = AembedName.find_last_of(".");
        string embedName = AembedName.substr(0, lastindex);
        string embData = expL[AembedName];
        struct entry *embEntry = make_entry_from_string(embedName.c_str(), embData);
        entries.push_back(*embEntry);
    }

    // Add Sparse count Matrix to entries - matsparse
    // arma::uvec iData((unsigned int *)INTEGER(matsparse.slot("i")), LENGTH(matsparse.slot("i")), false, true);
    // arma::uvec Dim((unsigned int *)INTEGER(matsparse.slot("Dim")), LENGTH(matsparse.slot("Dim")), false, true);
    // arma::uvec pData((unsigned int *)INTEGER(matsparse.slot("p")), LENGTH(matsparse.slot("p")), false, true);
    // arma::vec xData(REAL(matsparse.slot("x")), LENGTH(matsparse.slot("x")), false, true);

    
    // IntegerVector i = mat.slot("i");
    // IntegerVector p = mat.slot("p");
    // NumericVector x = mat.slot("x");

    // list<uint32_t> *iData;
    IntegerVector viData = expL["matsparse_i"];
    list<uint32_t> *iData;
    iData = IVtoL<uint32_t>(viData);

    // iData = as<std::list<uint32_t>* >(expL["matsparse_i"]);
    // iData(Mi->begin(), Mi->end());

    IntegerVector vDim = expL["matsparse_dim"];
    list<uint32_t> *Dim;
    Dim = IVtoL<uint32_t>(vDim);

    // list<uint32_t> *Dim;
    // Dim = as<std::list<uint32_t>*>(expL["matsparse_Dim"]);
    // Dim(Md.begin(), Md.end());

    IntegerVector vpData = expL["matsparse_p"];
    list<uint32_t> *pData;
    pData = IVtoL<uint32_t>(vpData);

    // list<uint32_t> *pData;
    // pData = as<std::list<uint32_t>*>(expL["matsparse_p"]);
    // pData(Mp.begin(), Mp.end());

    NumericVector vxData = expL["matsparse_x"];
    list<float> *xData;
    xData = NVtoL<float>(vxData);

    // list<float> *xData;
    // xData = as<std::list<float>*>(expL["matsparse_x"]);
    // xData(Mx.begin(), Mx.end());

    cout << "\t\tp array size: " << pData->size() << " [First entry value: " << pData->front() << "]" << endl;
    cout << "\t\ti array size: " << iData->size() << " [First entry value: " << iData->front() << "]" << endl;
    cout << "\t\tx array size: " << xData->size() << " [First entry value: " << xData->front() << "]" << endl;

    // list<uint32_t> *iData;
    // iData = (unsigned int *)INTEGER(matsparse.slot("i"));
    // list<uint32_t> *Dim;
    // Dim = (unsigned int *)INTEGER(matsparse.slot("Dim"));
    // list<uint32_t> *pData;
    // pData = (unsigned int *)INTEGER(matsparse.slot("p"));
    // list<float> *xData;
    // xData = (float)INTEGER(matsparse.slot("x"));

    string matsparseDimnames1 = expL["matsparse_dimnames1"];
    matsparseDimnames1.push_back('\0');
    string matsparseDimnames2 = expL["matsparse_dimnames2"];
    matsparseDimnames2.push_back('\0');

    struct sparseMatrixHeader smh;
    list<uint32_t>::iterator li = Dim->begin();
    smh.dim1 = *li;
    li++;
    smh.dim2 = *li;

    smh.pStartOffset = sizeof(struct sparseMatrixHeader);
    smh.iStartOffset = smh.pStartOffset + sizeof(uint32_t) * pData->size();
    smh.xStartOffset = smh.iStartOffset + sizeof(uint32_t) * iData->size();
    smh.dimname1StartOffset = smh.xStartOffset + sizeof(uint32_t) * xData->size();
    smh.dimname2StartOffset = smh.dimname1StartOffset + matsparseDimnames1.size();
    smh.dimname2EndOffset = smh.dimname2StartOffset + matsparseDimnames2.size();

    cout << "\tExpression matrix header information" << endl;
    cout << "\t\tdim1=" << smh.dim1 << endl;
    cout << "\t\tdim2=" << smh.dim2 << endl;
    cout << "\t\tpStartOffset=" << smh.pStartOffset << endl;
    cout << "\t\tiStartOffset=" << smh.iStartOffset << endl;
    cout << "\t\txStartOffset=" << smh.xStartOffset << endl;
    cout << "\t\tdimnames1StartOffset=" << smh.dimname1StartOffset << endl;
    cout << "\t\tdimnames2StartOffset=" << smh.dimname2StartOffset << endl;
    cout << "\t\tdimnames2EndOffset=" << smh.dimname2EndOffset << endl;


    // Make a memory holder for the data
    stringstream smhData(stringstream::in | stringstream::out | stringstream::binary);

    // Write the header
    smhData.write((const char *)&smh, sizeof(smh));

    // Write the p object
    for (list<uint32_t>::const_iterator iter = pData->begin(); iter != pData->end(); ++iter)
    {
        smhData.write((const char *) &*iter, sizeof(uint32_t));
    }

    // Write the i object
    for (list<uint32_t>::const_iterator iter = iData->begin(); iter != iData->end(); ++iter)
    {
        smhData.write((const char *) &*iter, sizeof(uint32_t));
    }

    // Write the x object
    for (list<float>::const_iterator iter = xData->begin(); iter != xData->end(); ++iter)
    {
        //smhData << *iter;
        smhData.write((const char *) &*iter, sizeof(uint32_t));
    }

    // Write the Dimnames as JSON string
    smhData.write(matsparseDimnames1.c_str(), matsparseDimnames1.size());
    smhData.write(matsparseDimnames2.c_str(), matsparseDimnames2.size());

    // Convert the buffer to a string
    string smhDataString = smhData.str();

    struct entry *sparseMatrixEntry = make_entry_from_string("sparseMatrix", smhDataString);
    entries.push_back(*sparseMatrixEntry);
    // ------------------------  Count Matrix  ------------------------
    // SEXP matasp = expL["mataspect"];
    // S4 mataspect(matasp);
    
    // Add Sparse Aspect Matrix to entries - mataspect
    // arma::uvec AiData((unsigned int *)INTEGER(mataspect.slot("i")), LENGTH(mataspect.slot("i")), false, true);
    // arma::uvec ADim((unsigned int *)INTEGER(mataspect.slot("Dim")), LENGTH(mataspect.slot("Dim")), false, true);
    // arma::uvec ApData((unsigned int *)INTEGER(mataspect.slot("p")), LENGTH(mataspect.slot("p")), false, true);
    // arma::vec AxData(REAL(mataspect.slot("x")), LENGTH(mataspect.slot("x")), false, true);

    IntegerVector AviData = expL["mataspect_i"];
    list<uint32_t> *AiData;
    AiData = IVtoL<uint32_t>(AviData);

    IntegerVector AvpData = expL["mataspect_p"];
    list<uint32_t> *ApData;
    ApData = IVtoL<uint32_t>(AvpData);

    IntegerVector AvDim = expL["mataspect_dim"];
    list<uint32_t> *ADim;
    ADim = IVtoL<uint32_t>(AvDim);

    NumericVector AvxData = expL["mataspect_x"];
    list<float> *AxData;
    AxData = NVtoL<float>(AvxData);

    // list<uint32_t> *iData;
    // iData = as.INTEGER(mataspect.slot("i"));
    // list<uint32_t> *Dim;
    // Dim = (unsigned int *)INTEGER(mataspect.slot("Dim"));
    // list<uint32_t> *pData;
    // pData = (unsigned int *)INTEGER(mataspect.slot("p"));
    // list<float> *xData;
    // xData = (float)INTEGER(mataspect.slot("x"));

    cout << "\t\tp array size: " << ApData->size() << " [First entry value: " << ApData->front() << "]" << endl;
    cout << "\t\ti array size: " << AiData->size() << " [First entry value: " << AiData->front() << "]" << endl;
    cout << "\t\tx array size: " << AxData->size() << " [First entry value: " << AxData->front() << "]" << endl;

    string mataspectDimnames1 = expL["mataspect_dimnames1"];
    mataspectDimnames1.push_back('\0');
    string mataspectDimnames2 = expL["mataspect_dimnames2"];
    mataspectDimnames2.push_back('\0');

    struct sparseMatrixHeader Asmh;
    list<uint32_t>::iterator Ali = ADim->begin();
    Asmh.dim1 = *Ali;
    Ali++;
    Asmh.dim2 = *Ali;

    Asmh.pStartOffset = sizeof(struct sparseMatrixHeader);
    Asmh.iStartOffset = Asmh.pStartOffset + sizeof(uint32_t) * ApData->size();
    Asmh.xStartOffset = Asmh.iStartOffset + sizeof(uint32_t) * AiData->size();
    Asmh.dimname1StartOffset = Asmh.xStartOffset + sizeof(uint32_t) * AxData->size();
    Asmh.dimname2StartOffset = Asmh.dimname1StartOffset + mataspectDimnames1.size();
    Asmh.dimname2EndOffset = Asmh.dimname2StartOffset + mataspectDimnames2.size();

    cout << "\tAspect matrix header information" << endl;
    cout << "\t\tdim1=" << Asmh.dim1 << endl;
    cout << "\t\tdim2=" << Asmh.dim2 << endl;
    cout << "\t\tpStartOffset=" << Asmh.pStartOffset << endl;
    cout << "\t\tiStartOffset=" << Asmh.iStartOffset << endl;
    cout << "\t\txStartOffset=" << Asmh.xStartOffset << endl;
    cout << "\t\tdimnames1StartOffset=" << Asmh.dimname1StartOffset << endl;
    cout << "\t\tdimnames2StartOffset=" << Asmh.dimname2StartOffset << endl;
    cout << "\t\tdimnames2EndOffset=" << Asmh.dimname2EndOffset << endl;

    // Make a memory holder for the data
    stringstream AsmhData(stringstream::in | stringstream::out | stringstream::binary);

    // Write the header
    AsmhData.write((const char *) &Asmh, sizeof(Asmh));

    // Write the p object
    for (list<uint32_t>::const_iterator iter = ApData->begin(); iter != ApData->end(); ++iter)
    {
        AsmhData.write((const char *) &*iter, sizeof(uint32_t));
    }

    // Write the i object
    for (list<uint32_t>::const_iterator iter = AiData->begin(); iter != AiData->end(); ++iter)
    {
        AsmhData.write((const char *) &*iter, sizeof(uint32_t));
    }

    // Write the x object
    for (list<float>::iterator iter = AxData->begin(); iter != AxData->end(); ++iter)
    {
        //AsmhData << *iter;
        AsmhData.write((const char *) &*iter, sizeof(uint32_t));
    }

    // Write the Dimnames as JSON string
    AsmhData.write(mataspectDimnames1.c_str(), mataspectDimnames1.size());
    AsmhData.write(mataspectDimnames2.c_str(), mataspectDimnames2.size());

    // Convert the buffer to a string
    string AsmhDataString = AsmhData.str();

    struct entry *AsparseMatrixEntry = make_entry_from_string("aspectMatrix", AsmhDataString);
    entries.push_back(*AsparseMatrixEntry);
    // ------------------------  Aspect Matrix  ------------------------

    // - Aspect Information
    struct entry *aspectInformationEntry = make_entry_from_string("aspectinformation", aspectInformationData);
    entries.push_back(*aspectInformationEntry);

    // - Genesets Data
    struct entry *genesetsEntry = make_entry_from_string("genesets", genesetsData);
    entries.push_back(*genesetsEntry);

    // - Genesets-genes Data
    struct entry *genesetsgenesEntry = make_entry_from_string("genesetsgenes", genesetsgenesData);
    entries.push_back(*genesetsgenesEntry);



    // Writing file
    cout << "Making File from payload..." << endl;

    cout << "\tFile format information" << endl;
    cout << "\t\tIndex entry size is " << sizeof(indexEntry) << " bytes" << endl;
    cout << "\t\tFile header size is " << sizeof(fileHeader) << " bytes" << endl;

    // Export entries to file
    ofstream fs;
    fs.open(outfile, ios::out | ios::binary);

    cout << "\tPreparing header..." << endl;
    struct fileHeader header;

    // Clear the memory to avoid rubbish data written to the file
    memset(&header, 0, sizeof(header));

    strcpy(header.identifier, "pagoda2datafile");
    header.versionMajor = 1;
    header.versionMinor = 0;
    header.flags = 0xFFFF;

    header.blockSize = FILE_BLOCK_SIZE;
    header.headerSize = sizeof(struct fileHeader);
    header.indexSize = sizeof(indexEntry) * entries.size();

    // TODO if verbose
    cout << "\tTotal index size is: " << header.indexSize << " bytes" << endl;

    // Construct the index in memory
    cout << "\tConstructing index..." << endl;

    list<indexEntry> indexEntries;
    uint32_t curOffset = 0; // in blocks

    for (list<entry>::iterator iterator = entries.begin(); iterator != entries.end(); ++iterator)
    {
        struct indexEntry ie;

        // Copy the key
        memcpy(ie.key, iterator->key, 128);

        ie.sizeBlocks = iterator-> blockSize;

        // Update the offset
        ie.offset = curOffset;

        // Flags are reserved for future use
        ie.flags = 0;

        // Put on the output list
        indexEntries.push_back(ie);

        // Increment the offset
        curOffset += iterator->blockSize;
    }

    // Write the header
    fs.write((const char *) &header, sizeof(header));

    // Write the index entries
    for (list<indexEntry>::iterator iterator = indexEntries.begin(); iterator != indexEntries.end(); ++iterator)
    {
        fs.write((const char *)&(*iterator), sizeof(indexEntry));
    }

    // Write the file content:
    int i = 0;
    for (list<entry>::iterator iterator = entries.begin(); iterator != entries.end(); ++iterator)
    {
        cout << "\t\tWriting entry " << i++;
        size_t s = iterator->blockSize * FILE_BLOCK_SIZE;
        cout << " of size " << iterator->blockSize << " blocks (or " << s << " bytes)" << endl;
        void *entry = malloc(s);
        if (entry == 0)
        {
            throw EX_MEM_ALLOC_FAIL;
        }

        // fill wiht 0s
        memset(entry, 0, s);
        // copy the payload
        memcpy(entry, (const char *)iterator->payload, iterator->size);

        fs.write((const char *)entry, s);

        free(entry);
    }

    fs.close();
}