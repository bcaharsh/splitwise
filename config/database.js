import mysql2 from "mysql2"

const pool=mysql2.createPool({
    host:"localhost",
    password:process.env.DB_PASSWORD,
    user:"root",
    database:"splitwise_app",
    port:3306,
    connectionLimit:10
})

try{
    if(pool.promise().getConnection()){
        console.log("DB Connected")
    }else{
        console.log("DB NOT Connected")
    }
}catch(error){
    console.log(error)
    throw new error
}

export default pool.promise()