// require('dotenv').config({path: './env'});
import mongoose from "mongoose";
import dotenv from 'dotenv';
import express from 'express';
import connectDB from "./db/index.js";
// import { DB_NAME }  from "./constants";
const app = express();
dotenv.config({path: './env'})


connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server is running on port ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO DB CONNECTION FAILED !!", err);
})

/*
(async()=>{
    try{
     await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
     app.on("error", (error)=>{
        console.log("error", error);
        throw error;
     })
     app.listen(process.env.PORT, ()=>{
        console.log(`server is running on port ${process.env.PORT}`);
     })
    }catch(err){
        console.error("Error" ,err);
        throw err;
    }
})()
    */