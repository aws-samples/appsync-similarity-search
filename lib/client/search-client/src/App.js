// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


import { generateClient } from 'aws-amplify/api';
import * as queries from './graphql/queries';

import React, { useState } from 'react';
import './App.css';

import { Amplify } from 'aws-amplify';
import config from './aws_exports'
Amplify.configure(config);
const client = generateClient();


function App() {
  const [productData, setProductData] = useState([]);
  const [productDetails, setProductDetails] = useState(null);
  const [queryString, setQueryString] = useState("Portronics ")

  const productList = productData.map((product) =>
    <tr>
      <td><button onClick={() => fetchProductById(product.product_id)}> {product.product_id}</button></td>
      <td>{product.product_name}</td>
    </tr>
  );

  async function fetchProductById(product_id) {
    console.log("fetchProductById", product_id);
    const variables = {
      product_id : product_id
    };

    try {
      const response = await client.graphql({ query: queries.getProductById, variables: variables});
      setProductDetails(response.data.getProductById);
    } catch (error) {
      console.error('Error fetching product:', error);
    }
  }

  async function fetchProductsBySimilarity(search_string) {
    const variables = {
      query : search_string
    };

    try {
      const response = await client.graphql({ query: queries.getProductsBySimilarity, variables: variables});
      setProductData(response.data.getProductsBySimilarity);
    } catch (error) {
      console.error('Error fetching search results:', error);
    }
  }


  return (
    <div>
      <h1>Search for Products</h1>
      <input type="text" onChange={(e) => setQueryString(e.target.value)}></input>
      <button onClick={() => fetchProductsBySimilarity(queryString)}>Search</button>

      
      {productData.length !== 0 ? (
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
          {productList}
          </tbody>
        </table>
      ) : (
        <p>...</p>
      )}

      {productDetails ?
        <div>
          <h1>Product Details</h1>
          <p>Product Price: {productDetails.actual_price}</p>
          <p>About Product: {productDetails.about_product}</p>
        </div>
        :
        <p></p>
      }    
    </div>
  );
}

export default App;
