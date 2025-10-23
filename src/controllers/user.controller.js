import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async(userId) => {
  try{
          const user =  await User.findById(userId)
          const accessToken =   user.generateAccessToken()
          const refreshToken = user.generateRefreshToken()
          user.refreshToken =  refreshToken
          await user.save({validateBeforeSave: false})
 
          return {accessToken, refreshToken}
        }catch(error){
    throw new ApiError (500, "something went wrong while generating refresh ans access token")
  }
}


const registerUser = asyncHandler(async (req, res)=>{
     // get user details from frontend
      const {username, email, password, fullname} =  req.body;
     
      //  console.log("Input received:", { username, email, password, fullname });

    //  validation - not empty
      if(
        [fullname, email, password, username].some((field)=>
        field?.trim() === "")){
        throw new ApiError(400,"all fields are required");
      }
      if(!email.includes("@")){
        throw new ApiError(400, "email is invalid")
      }
      if(password.length < 6){
        throw new ApiError(400, "Password must be at least 6 characters long");
      }
    // check user already registered

    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    });
    // console.log("Existed user:", existedUser);

    if(existedUser){
        throw new ApiError(409, "User already registered ");
    }

      // console.log("req.files:", req.files);
    // check for images check for avatar
      const avatarLocalPath =  req.files?.avatar[0]?.path;
      // console.log("avatarLocalPath", avatarLocalPath);
      const coverImageLocalPath =  req.files?.coverImage[0]?.path;; 
     
      
     
      if(!avatarLocalPath){
      throw new ApiError(400, "Avatar image is required");
     }

    // upload to cloudinary, check avatar
    const avatar =  await uploadOnCloudinary(avatarLocalPath);
    // console.log("avatar", avatar);
   
    const coverImage   =  await uploadOnCloudinary(coverImageLocalPath);
    // console.log("coverImage after Cloudinary upload:", coverImage);

     if (!avatar) {
    throw new ApiError(400, "Avatar image upload failed");
  }

  
    // create user object -  create entry in db
     const user = await User.create({
        username: username.toLowerCase(),
        email,
        password,
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url|| "",
      })

    const CreatedUser =   await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!CreatedUser){
        throw new ApiError(500, "Something went wrong while register the user");
    }

    return res.status(201).json(
        new ApiResponse(200, CreatedUser, "User registered Successfully")
    )
})


const loginUser =  asyncHandler(async (req, res)=>{
       // red body
          const {username , email , password} =  req.body;   
          
          console.log("user exist", {email, password, username});

          if(!username && !email){
            throw new ApiError(400, "username or password required");
          }


        // username or email
        const user =  await User.findOne({
            $or: [{username}, {email}]
          })

        // find the user
            if(!user){
              throw new ApiError(404, "User does not Exist");
            }
        // password check
           const isPasswordValid = await user.isPasswordCorrect(password);
            

           if(!isPasswordValid){
            throw new ApiError(401, "Invalid user creadentials");
           }

        // access and refreshToken
         const {refreshToken, accessToken} = await generateAccessAndRefreshToken(user._id)     
        
        const loggedInUser =  await User.findById(user._id).select("-pasword -refreshToken")

        // send cookie

        const options = {
          httpOnly: true,
          secure: true
        }

        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
          new ApiResponse(
            200,{
              user: loggedInUser, accessToken, refreshToken
            }, "User loggedIn successFully"
          )
        )
})

const refreshAccessToken  =  asyncHandler(async(req, res)=>{
 const incommingRefreshToken = await req.cookies.refreshToken || req.body.refreshToken

 if(!incommingRefreshToken){
  throw new ApiError(401,"Unauthorized request")
 }

  try {
    const decodedToken =  jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET)
  
  const user = await User.findById(decodedToken?._id)
  
  if(!user){
    throw new ApiError(401,"Invalid RefreshToken")
   }
   if(incommingRefreshToken !== user?.refreshToken){
    throw new ApiError(401, "refreshToken token is expired or used")
   }
  
   const options = {
    httpOnly: true,
    secure: true
   }
   const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
   return res
   .status(200)
   .cookie("accessToken", accessToken,options)
   .cookie("refreshToken", newRefreshToken,options)
   .json(
    new ApiResponse(200,
      {accessToken, refreshToken: newRefreshToken},
      "Access Token refreshed"
    )
   )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }

})


const logoutUser = asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          refreshToken: undefined
        }
      },{
      new: true
      }
    )
    
        const options = {
          httpOnly: true,
          secure: true
        }

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200, {}, "User logged Out"))


})


const changeCurrentPassword = asyncHandler(async(req, res)=>{
  const {oldPassword, newPassword} =  req.body;
   
  const user =  await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(400, "Invalid oldPassword");
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

 return res
 .status(200)
 .json(new ApiResponse(200, {}, "password chnage SucccessFully"));

})


const getCurrentUser = asyncHandler(async(req, res)=>{
 return res
 .status(200)
 .json(new ApiResponse(200, req.user,"current user fetched successfully"))

})


const updateAccountDetails =  asyncHandler(async(req, res)=>{
  const {fullname, email, username} =  req.body;

  if(!fullname || !email || !username){
    throw new ApiError(400, "All field are required")
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
       fullname:  fullname,
       email: email,
       username: username
      }
    },
    {new: true}

  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Account Details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req, res)=>{

  const avatarLocalPath =  req.file?.path
  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is missing")
  }

  const avatar =  await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
        throw new ApiError(400, "Error while uploading on Avatar")
  }

  const user = await User.findByIdAndUpdate(req.user._id
    ,
    {
      $set:{
        avatar: avatar.url
      }
    }
    ,{
      new: true
    }
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Avatar is updated Successfully"))
})

const updateUserCoverImage = asyncHandler(async(req, res)=>{

  const coverImageLocalPath =  req.file?.path
  if(!coverImageLocalPath){
    throw new ApiError(400, "coverimage file is missing")
  }

  const coverImage =  await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on Avatar")
  }

  const user = await User.findByIdAndUpdate(req.user._id
    ,
    {
      $set:{
        coverImage: coverImage.url
      }
    }
    ,{
      new: true
    }
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200, user, "coverImage updated successFully")
  )
})

export {registerUser, loginUser,
       logoutUser, refreshAccessToken,
       changeCurrentPassword, getCurrentUser
       ,updateAccountDetails,updateUserAvatar,
       updateUserCoverImage
      };