import jwt from 'jsonwebtoken'
const protect = async (req, res, next) => {
    const token = req.headers.authorization;
    if(!token){
        return res.status(401).json({message: 'Unauthorized'});
    }
    try{
        const tokenToVerify = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
        const decoded = jwt.verify(tokenToVerify, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    }
    catch(error){
        return res.status(401).json({message: 'Unauthorized'});
    }
}
export default protect;