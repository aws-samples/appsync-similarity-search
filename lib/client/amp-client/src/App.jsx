import { useState } from 'react'
import { generateClient } from "aws-amplify/data";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Table from "@cloudscape-design/components/table";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Link from "@cloudscape-design/components/link";


function App() {
  const [productData, setProductData] = useState([]);
  const [productDetails, setProductDetails] = useState(null);
  const [queryString, setQueryString] = useState("Portronics ")

/**
 * @type {import('aws-amplify/data').Client<import('../amplify/data/resource').Schema>}
 */
  const client = generateClient({authMode:'apiKey'});

  async function fetchProductById(product_id) {
    console.log("fetchProductById", product_id);
    const variables = {
      product_id : product_id
    };

    
      const {data, errors} = await client.queries.getProduct(variables)
      if (!errors) {
        console.log(data);
        setProductDetails(data);
      } else {
        console.log(errors);
      }  
  }

  async function fetchProductsBySimilarity(search_string) {
    const variables = {
      query : search_string
    };

    
      const { data, errors } = await client.queries.search(variables)
      if (!errors) {
        console.log(data);
        setProductData(data);
      } else {
        console.log(errors);
      }
    
  }

  return (
    <ContentLayout defaultPadding>
    <Container
      header={
        <Header
          variant="h2"
        >
          Search your Product Catalog
        </Header>
      }
    >
      
      

      <Table
      renderAriaLive={({
        firstIndex,
        lastIndex,
        totalItemsCount
      }) =>
        `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
      }
      columnDefinitions={[
        {
          id: "product_id",
          header: "Product Id",
          cell: item => (
            <Link onClick={() => fetchProductById(item.product_id)} href="#">{item.product_id || "-"}</Link>
          ),
          sortingField: "name",
          isRowHeader: true
        },
        {
          id: "product_name",
          header: "Product Name",
          cell: item => item.product_name || "-",
          sortingField: "alt"
        }
      ]}
      enableKeyboardNavigation
      items={productData}
      loadingText="Loading resources"
      sortingDisabled
      empty={
        <Box
          margin={{ vertical: "xs" }}
          textAlign="center"
          color="inherit"
        >
          <SpaceBetween size="m">
            <b>No products listed</b>
            <Button onClick={() => fetchProductsBySimilarity(queryString)} variant="primary">
              Search
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={<Header
        actions={
          <SpaceBetween
            direction="horizontal"
            size="xs"
          >
            <FormField
      >
        <Input
          value={queryString}
          onChange={event =>
            setQueryString(event.detail.value)
          }
        />
      </FormField>
            <Button onClick={() => fetchProductsBySimilarity(queryString)} variant="primary">
              Search
            </Button>
          </SpaceBetween>
        }
      >
      </Header>}
    />    
      
      
      {productDetails ?
        <div>
          <h3>Product Details</h3>
          <p>Product Price: {productDetails.actual_price}</p>
          <p>About Product: {productDetails.about_product}</p>
        </div>
        :
        <p></p>
      }
    </Container>
    </ContentLayout>
  )
}

export default App
